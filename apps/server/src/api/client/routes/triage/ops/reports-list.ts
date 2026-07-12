import { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';

import { database } from '@colanode/server/data/database';
import { SelectTriageReport } from '@colanode/server/data/schema';

export const opsReportOutputSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  sourceAdapter: z.string(),
  reporterId: z.string().nullable(),
  reporterName: z.string(),
  title: z.string(),
  did: z.string(),
  expected: z.string(),
  got: z.string(),
  pageUrl: z.string(),
  pageTitle: z.string(),
  pins: z.array(z.unknown()),
  debugContext: z.record(z.string(), z.unknown()),
  artifacts: z.array(
    z.object({
      id: z.string(),
      kind: z.string(),
      contentType: z.string(),
      storagePath: z.string(),
    })
  ),
  status: z.string(),
  createdAt: z.string(),
});

export const mapReport = (row: SelectTriageReport) => ({
  id: row.id,
  projectId: row.project_id,
  sourceAdapter: row.source_adapter,
  reporterId: row.reporter_id,
  reporterName: row.reporter_name,
  title: row.title,
  did: row.did,
  expected: row.expected,
  got: row.got,
  pageUrl: row.page_url,
  pageTitle: row.page_title,
  pins: row.pins,
  debugContext: row.debug_context,
  artifacts: row.artifacts,
  status: row.status,
  createdAt: row.created_at.toISOString(),
});

export const triageOpsReportsListRoute: FastifyPluginCallbackZod = (
  instance,
  _,
  done
) => {
  instance.route({
    method: 'GET',
    url: '/reports',
    schema: {
      querystring: z.object({
        status: z.enum(['new', 'exploded']).default('new'),
        projectId: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(200).default(50),
      }),
      response: {
        200: z.object({ reports: z.array(opsReportOutputSchema) }),
      },
    },
    handler: async (request) => {
      let query = database
        .selectFrom('triage_reports')
        .selectAll()
        .where('status', '=', request.query.status)
        .orderBy('created_at', 'asc')
        .limit(request.query.limit);

      if (request.query.projectId) {
        query = query.where('project_id', '=', request.query.projectId);
      }

      const rows = await query.execute();
      return { reports: rows.map(mapReport) };
    },
  });

  done();
};
