import { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';

import { database } from '@colanode/server/data/database';
import { SelectTriageItem } from '@colanode/server/data/schema';

export const opsItemOutputSchema = z.object({
  id: z.string(),
  reportId: z.string(),
  projectId: z.string(),
  kind: z.string(),
  summary: z.string(),
  sourceRef: z.record(z.string(), z.unknown()),
  triage: z.string().nullable(),
  triageReason: z.string(),
  confidence: z.number().nullable(),
  clusterId: z.string().nullable(),
  decision: z.string().nullable(),
  agentNote: z.string(),
  status: z.string(),
});

export const mapItem = (row: SelectTriageItem) => ({
  id: row.id,
  reportId: row.report_id,
  projectId: row.project_id,
  kind: row.kind,
  summary: row.summary,
  sourceRef: row.source_ref,
  triage: row.triage,
  triageReason: row.triage_reason,
  confidence: row.confidence,
  clusterId: row.cluster_id,
  decision: row.decision,
  agentNote: row.agent_note,
  status: row.status,
});

const opsClusterOutputSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  rootHypothesis: z.string(),
  itemCount: z.number(),
  status: z.string(),
  boardRecordId: z.string().nullable(),
  chatCardId: z.string().nullable(),
  items: z.array(opsItemOutputSchema),
});

export const triageOpsClustersListRoute: FastifyPluginCallbackZod = (
  instance,
  _,
  done
) => {
  instance.route({
    method: 'GET',
    url: '/clusters',
    schema: {
      querystring: z.object({
        status: z.enum(['open', 'decided', 'escalated']).default('open'),
        projectId: z.string().optional(),
      }),
      response: {
        200: z.object({ clusters: z.array(opsClusterOutputSchema) }),
      },
    },
    handler: async (request) => {
      let query = database
        .selectFrom('triage_clusters')
        .selectAll()
        .where('status', '=', request.query.status)
        .orderBy('created_at', 'asc');

      if (request.query.projectId) {
        query = query.where('project_id', '=', request.query.projectId);
      }

      const clusters = await query.execute();
      const clusterIds = clusters.map((c) => c.id);
      const items =
        clusterIds.length > 0
          ? await database
              .selectFrom('triage_items')
              .selectAll()
              .where('cluster_id', 'in', clusterIds)
              .execute()
          : [];

      return {
        clusters: clusters.map((cluster) => ({
          id: cluster.id,
          projectId: cluster.project_id,
          rootHypothesis: cluster.root_hypothesis,
          itemCount: cluster.item_count,
          status: cluster.status,
          boardRecordId: cluster.board_record_id,
          chatCardId: cluster.chat_card_id,
          items: items
            .filter((item) => item.cluster_id === cluster.id)
            .map(mapItem),
        })),
      };
    },
  });

  done();
};
