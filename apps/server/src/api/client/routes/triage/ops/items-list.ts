import { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';

import { database } from '@colanode/server/data/database';

import { mapItem, opsItemOutputSchema } from './clusters-list';

/**
 * List items by status — the sweep's RESUME path.
 *
 * The sweep used to work off `reports?status=new` alone. But explode flips the
 * report to `exploded` immediately, so if a run died between explode and
 * triage/cluster (LLM timeout, rate limit, crash), its items were stranded
 * forever: no later sweep would ever fetch them again and the tester's bug
 * vanished silently.
 *
 * Items — not reports — are the real unit of work. Listing them by status lets
 * a sweep pick up anything a previous run left behind, which makes the whole
 * pipeline idempotent and crash-safe.
 */
export const triageOpsItemsListRoute: FastifyPluginCallbackZod = (
  instance,
  _,
  done
) => {
  instance.route({
    method: 'GET',
    url: '/items',
    schema: {
      querystring: z.object({
        status: z.enum(['new', 'triaged', 'clustered', 'decided', 'escalated']),
        projectId: z.string().optional(),
        // `unclustered` narrows to items not yet attached to a cluster — the
        // clustering stage's work queue.
        unclustered: z.coerce.boolean().optional(),
        limit: z.coerce.number().int().min(1).max(200).default(100),
      }),
      response: {
        200: z.object({ items: z.array(opsItemOutputSchema) }),
      },
    },
    handler: async (request) => {
      let query = database
        .selectFrom('triage_items')
        .selectAll()
        .where('status', '=', request.query.status)
        .orderBy('created_at', 'asc')
        .limit(request.query.limit);

      if (request.query.projectId) {
        query = query.where('project_id', '=', request.query.projectId);
      }

      if (request.query.unclustered) {
        query = query.where('cluster_id', 'is', null);
      }

      const rows = await query.execute();
      return { items: rows.map(mapItem) };
    },
  });

  done();
};
