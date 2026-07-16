import { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { sql } from 'kysely';
import { z } from 'zod/v4';

import { ApiErrorCode, apiErrorOutputSchema } from '@colanode/core';
import { database } from '@colanode/server/data/database';

const clusterCreateSchema = z.object({
  projectId: z.string().min(1),
  rootHypothesis: z.string().min(1),
  itemIds: z.array(z.guid()).min(1),
  reason: z.string().default(''),
  relatedClusterIds: z.array(z.guid()).max(5).default([]),
  confidence: z.number().min(0).max(1).optional(),
});

export const triageOpsClusterCreateRoute: FastifyPluginCallbackZod = (
  instance,
  _,
  done
) => {
  instance.route({
    method: 'POST',
    url: '/clusters',
    schema: {
      body: clusterCreateSchema,
      response: {
        200: z.object({ id: z.string() }),
        400: apiErrorOutputSchema,
      },
    },
    handler: async (request, reply) => {
      const { projectId, rootHypothesis, itemIds, reason } = request.body;

      const items = await database
        .selectFrom('triage_items')
        .select(['id', 'project_id'])
        .where('id', 'in', itemIds)
        .execute();

      if (
        items.length !== itemIds.length ||
        items.some((item) => item.project_id !== projectId)
      ) {
        return reply.code(400).send({
          code: ApiErrorCode.BadRequest,
          message: 'itemIds must all exist and belong to the project',
        });
      }

      const { relatedClusterIds, confidence } = request.body;
      if (relatedClusterIds.length > 0) {
        const related = await database
          .selectFrom('triage_clusters')
          .select(['id', 'project_id'])
          .where('id', 'in', relatedClusterIds)
          .execute();
        if (
          related.length !== relatedClusterIds.length ||
          related.some((c) => c.project_id !== projectId)
        ) {
          return reply.code(400).send({
            code: ApiErrorCode.BadRequest,
            message: 'relatedClusterIds must all exist and belong to the project',
          });
        }
      }

      const clusterId = await database.transaction().execute(async (trx) => {
        const cluster = await trx
          .insertInto('triage_clusters')
          .values({
            project_id: projectId,
            root_hypothesis: rootHypothesis,
            item_count: itemIds.length,
          })
          .returning('id')
          .executeTakeFirstOrThrow();

        const auditEntry = JSON.stringify([
          {
            at: new Date().toISOString(),
            actor: 'ops',
            changes: { clusterId: cluster.id, reason },
          },
        ]);

        await trx
          .updateTable('triage_items')
          .set({
            cluster_id: cluster.id,
            status: 'clustered',
            // append at the SQL layer to preserve any concurrent audit entries
            audit: sql`audit || ${auditEntry}::jsonb`,
            updated_at: new Date(),
          })
          .where('id', 'in', itemIds)
          .execute();

        for (const relatedId of relatedClusterIds) {
          const [a, b] = [cluster.id, relatedId].sort();
          await trx
            .insertInto('triage_cluster_relations')
            .values({
              project_id: projectId,
              cluster_a_id: a!,
              cluster_b_id: b!,
              reason,
              confidence: confidence ?? null,
              actor: 'ops',
            })
            .onConflict((oc) =>
              oc.columns(['cluster_a_id', 'cluster_b_id']).doNothing()
            )
            .execute();
        }

        return cluster.id;
      });

      return { id: clusterId };
    },
  });

  done();
};
