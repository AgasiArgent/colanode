import { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';

import { ApiErrorCode, apiErrorOutputSchema } from '@colanode/core';
import { database } from '@colanode/server/data/database';
import { explodeReport } from '@colanode/server/lib/triage/explode';

import { mapItem, opsItemOutputSchema } from './clusters-list';

export const triageOpsReportExplodeRoute: FastifyPluginCallbackZod = (
  instance,
  _,
  done
) => {
  instance.route({
    method: 'POST',
    url: '/reports/:reportId/explode',
    schema: {
      params: z.object({ reportId: z.guid() }),
      response: {
        200: z.object({ items: z.array(opsItemOutputSchema) }),
        404: apiErrorOutputSchema,
      },
    },
    handler: async (request, reply) => {
      const { reportId } = request.params;
      const report = await database
        .selectFrom('triage_reports')
        .selectAll()
        .where('id', '=', reportId)
        .executeTakeFirst();

      if (!report) {
        return reply.code(404).send({
          code: ApiErrorCode.BadRequest,
          message: 'Report not found',
        });
      }

      if (report.status === 'exploded') {
        const existing = await database
          .selectFrom('triage_items')
          .selectAll()
          .where('report_id', '=', reportId)
          .execute();
        return { items: existing.map(mapItem) };
      }

      const drafts = explodeReport({
        title: report.title,
        did: report.did,
        expected: report.expected,
        got: report.got,
        pageUrl: report.page_url,
        reporterName: report.reporter_name,
        pins: report.pins,
        debugContext: report.debug_context,
        artifacts: report.artifacts,
      });

      const inserted = await database.transaction().execute(async (trx) => {
        // Claim the report atomically: only the transaction that flips
        // new→exploded inserts items. A concurrent explode updates 0 rows and
        // returns null (TOCTOU-safe — no duplicate items).
        const claimed = await trx
          .updateTable('triage_reports')
          .set({ status: 'exploded' })
          .where('id', '=', reportId)
          .where('status', '=', 'new')
          .executeTakeFirst();

        if (claimed.numUpdatedRows === 0n) {
          return null;
        }

        return trx
          .insertInto('triage_items')
          .values(
            drafts.map((draft) => ({
              report_id: reportId,
              project_id: report.project_id,
              kind: draft.kind,
              summary: draft.summary,
              source_ref: JSON.stringify(draft.sourceRef),
            }))
          )
          .returningAll()
          .execute();
      });

      if (inserted === null) {
        // Lost the race — the winner exploded it; return the persisted items.
        const existing = await database
          .selectFrom('triage_items')
          .selectAll()
          .where('report_id', '=', reportId)
          .execute();
        return { items: existing.map(mapItem) };
      }

      return { items: inserted.map(mapItem) };
    },
  });

  done();
};
