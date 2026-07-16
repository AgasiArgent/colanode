import { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { sql } from 'kysely';
import { z } from 'zod/v4';

import { ApiErrorCode, apiErrorOutputSchema } from '@colanode/core';
import { database } from '@colanode/server/data/database';

const attachSchema = z.object({
  projectId: z.string().min(1),
  itemIds: z.array(z.guid()).min(1),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1),
});

// Fail-safe (spec §9): a projected cluster may only receive `same` evidence
// while our picture of human Linear decisions is fresh.
export const SYNC_FRESHNESS_MS = 6 * 60 * 60 * 1000;

const TERMINAL_STATE_TYPES = new Set(['completed', 'canceled']);

export const triageOpsClusterAttachRoute: FastifyPluginCallbackZod = (
  instance,
  _,
  done
) => {
  instance.route({
    method: 'POST',
    url: '/clusters/:clusterId/attach',
    schema: {
      params: z.object({ clusterId: z.guid() }),
      body: attachSchema,
      response: {
        200: z.object({ id: z.string(), itemCount: z.number() }),
        400: apiErrorOutputSchema,
      },
    },
    handler: async (request, reply) => {
      const { clusterId } = request.params;
      const { projectId, itemIds, confidence, reason } = request.body;

      const bad = (message: string) =>
        reply.code(400).send({ code: ApiErrorCode.BadRequest, message });

      const cluster = await database
        .selectFrom('triage_clusters')
        .selectAll()
        .where('id', '=', clusterId)
        .executeTakeFirst();
      if (!cluster || cluster.project_id !== projectId) {
        return bad('cluster not found in project');
      }
      if (cluster.status !== 'open') {
        return bad('cluster is not open');
      }

      const linear = await database
        .selectFrom('triage_linear_issues')
        .selectAll()
        .where('cluster_id', '=', clusterId)
        .executeTakeFirst();
      if (linear) {
        if (linear.canonical_cluster_id || linear.duplicate_of_external) {
          return bad('cluster is a duplicate alias — attach to its canonical');
        }
        if (TERMINAL_STATE_TYPES.has(linear.state_type)) {
          return bad('cluster issue is terminal — create a recurrence instead');
        }
        const sync = await database
          .selectFrom('triage_linear_sync_state')
          .selectAll()
          .where('project_id', '=', projectId)
          .executeTakeFirst();
        const fresh =
          sync?.last_success_at &&
          Date.now() - sync.last_success_at.getTime() < SYNC_FRESHNESS_MS;
        if (!fresh) {
          return bad(
            'linear sync is stale — no `same` attach to projected clusters this run'
          );
        }
      }

      const items = await database
        .selectFrom('triage_items')
        .select(['id', 'project_id', 'status', 'cluster_id'])
        .where('id', 'in', itemIds)
        .execute();
      if (
        items.length !== itemIds.length ||
        items.some(
          (i) =>
            i.project_id !== projectId ||
            i.status !== 'triaged' ||
            i.cluster_id !== null
        )
      ) {
        return bad(
          'itemIds must all exist, belong to the project, be triaged and unclustered'
        );
      }

      const auditEntry = JSON.stringify([
        {
          at: new Date().toISOString(),
          actor: 'ops',
          changes: { attach: clusterId, itemIds, confidence, reason },
        },
      ]);

      const itemCount = await database.transaction().execute(async (trx) => {
        // Guarded update: recheck state inside the transaction so two
        // concurrent sweeps cannot double-attach the same item.
        const updated = await trx
          .updateTable('triage_items')
          .set({
            cluster_id: clusterId,
            status: 'clustered',
            audit: sql`audit || ${auditEntry}::jsonb`,
            updated_at: new Date(),
          })
          .where('id', 'in', itemIds)
          .where('status', '=', 'triaged')
          .where('cluster_id', 'is', null)
          .returning('id')
          .execute();
        if (updated.length !== itemIds.length) {
          throw new Error('concurrent attach conflict');
        }

        const row = await trx
          .updateTable('triage_clusters')
          .set((eb) => ({
            item_count: eb('item_count', '+', itemIds.length),
            audit: sql`audit || ${auditEntry}::jsonb`,
            updated_at: new Date(),
          }))
          .where('id', '=', clusterId)
          .where('status', '=', 'open')
          .returning('item_count')
          .executeTakeFirstOrThrow();
        return row.item_count;
      });

      return { id: clusterId, itemCount };
    },
  });

  done();
};
