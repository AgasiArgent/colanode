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
        const rows = await trx
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

        await trx
          .updateTable('triage_reports')
          .set({ status: 'exploded' })
          .where('id', '=', reportId)
          .execute();

        return rows;
      });

      return { items: inserted.map(mapItem) };
    },
  });

  done();
};
