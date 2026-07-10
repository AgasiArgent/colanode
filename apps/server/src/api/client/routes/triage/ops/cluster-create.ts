import { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';

import { ApiErrorCode, apiErrorOutputSchema } from '@colanode/core';
import { database } from '@colanode/server/data/database';

const clusterCreateSchema = z.object({
  projectId: z.string().min(1),
  rootHypothesis: z.string().min(1),
  itemIds: z.array(z.guid()).min(1),
  reason: z.string().default(''),
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
        .select(['id', 'project_id', 'audit'])
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

        for (const item of items) {
          await trx
            .updateTable('triage_items')
            .set({
              cluster_id: cluster.id,
              status: 'clustered',
              audit: JSON.stringify([
                ...item.audit,
                {
                  at: new Date().toISOString(),
                  actor: 'ops',
                  changes: { clusterId: cluster.id, reason },
                },
              ]),
              updated_at: new Date(),
            })
            .where('id', '=', item.id)
            .execute();
        }

        return cluster.id;
      });

      return { id: clusterId };
    },
  });

  done();
};
