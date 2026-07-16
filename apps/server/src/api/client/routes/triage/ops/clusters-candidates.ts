import { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';

import { database } from '@colanode/server/data/database';

const candidateOutputSchema = z.object({
  id: z.string(),
  lifecycle: z.enum(['active', 'terminal', 'duplicate']),
  linearIdentifier: z.string().nullable(),
  canonicalClusterId: z.string().nullable(),
  duplicateOfExternal: z.string().nullable(),
  rootHypothesis: z.string(),
  classes: z.array(z.string()),
  itemCount: z.number(),
  samples: z.array(
    z.object({
      summary: z.string(),
      page: z.string(),
      component: z.string(),
    })
  ),
});

const TERMINAL_STATE_TYPES = new Set(['completed', 'canceled']);

export const triageOpsClustersCandidatesRoute: FastifyPluginCallbackZod = (
  instance,
  _,
  done
) => {
  instance.route({
    method: 'GET',
    url: '/clusters/candidates',
    schema: {
      querystring: z.object({
        projectId: z.string().min(1),
        limit: z.coerce.number().int().min(1).max(50).default(20),
        cursor: z.guid().optional(),
      }),
      response: {
        200: z.object({
          candidates: z.array(candidateOutputSchema),
          nextCursor: z.string().nullable(),
        }),
      },
    },
    handler: async (request) => {
      const { projectId, limit, cursor } = request.query;

      let query = database
        .selectFrom('triage_clusters')
        .selectAll()
        .where('project_id', '=', projectId)
        .orderBy('id', 'asc')
        .limit(limit + 1);
      if (cursor) {
        query = query.where('id', '>', cursor);
      }
      const clusters = await query.execute();
      const page = clusters.slice(0, limit);
      const nextCursor =
        clusters.length > limit ? page[page.length - 1]!.id : null;

      const clusterIds = page.map((c) => c.id);
      const [items, linearRows] = await Promise.all([
        clusterIds.length > 0
          ? database
              .selectFrom('triage_items')
              .select(['cluster_id', 'summary', 'triage', 'source_ref'])
              .where('cluster_id', 'in', clusterIds)
              .execute()
          : Promise.resolve([]),
        clusterIds.length > 0
          ? database
              .selectFrom('triage_linear_issues')
              .selectAll()
              .where('cluster_id', 'in', clusterIds)
              .execute()
          : Promise.resolve([]),
      ]);

      const candidates = page.map((cluster) => {
        const linear = linearRows.find((r) => r.cluster_id === cluster.id);
        const own = items.filter((i) => i.cluster_id === cluster.id);
        const lifecycle =
          linear?.canonical_cluster_id || linear?.duplicate_of_external
            ? ('duplicate' as const)
            : linear && TERMINAL_STATE_TYPES.has(linear.state_type)
              ? ('terminal' as const)
              : ('active' as const);
        return {
          id: cluster.id,
          lifecycle,
          linearIdentifier: linear?.identifier || null,
          canonicalClusterId: linear?.canonical_cluster_id ?? null,
          duplicateOfExternal: linear?.duplicate_of_external ?? null,
          rootHypothesis: cluster.root_hypothesis,
          classes: [
            ...new Set(own.map((i) => i.triage).filter((t): t is string => !!t)),
          ],
          itemCount: cluster.item_count,
          // Compact by design: no reporter identity, no debug payloads (spec §4).
          samples: own.slice(0, 3).map((i) => ({
            summary: i.summary,
            page: String((i.source_ref as Record<string, unknown>).page ?? ''),
            component: String(
              (i.source_ref as Record<string, unknown>).component ?? ''
            ),
          })),
        };
      });

      return { candidates, nextCursor };
    },
  });

  done();
};
