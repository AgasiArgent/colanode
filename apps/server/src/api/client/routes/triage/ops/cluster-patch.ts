import { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { sql } from 'kysely';
import { z } from 'zod/v4';

import { ApiErrorCode, apiErrorOutputSchema } from '@colanode/core';
import { database } from '@colanode/server/data/database';

import { mapCluster, opsClusterOutputSchema } from './clusters-list';

// The enums mirror the triage_clusters CHECK constraints, so a bad value is a
// 400 from validation rather than a 500 from Postgres.
const clusterPatchSchema = z
  .object({
    boardRecordId: z.string().optional(),
    chatCardId: z.string().optional(),
    status: z.enum(['open', 'decided', 'escalated']).optional(),
    decision: z
      .enum([
        'approved-for-fix',
        'backlog',
        'works-as-intended',
        'needs-info',
        'duplicate',
        'ignored',
      ])
      .optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: 'Empty patch',
  });

export const triageOpsClusterPatchRoute: FastifyPluginCallbackZod = (
  instance,
  _,
  done
) => {
  instance.route({
    method: 'PATCH',
    url: '/clusters/:clusterId',
    schema: {
      params: z.object({ clusterId: z.guid() }),
      body: clusterPatchSchema,
      response: {
        200: opsClusterOutputSchema,
        404: apiErrorOutputSchema,
      },
    },
    handler: async (request, reply) => {
      const { clusterId } = request.params;
      const body = request.body;

      const auditEntry = {
        at: new Date().toISOString(),
        actor: 'ops',
        changes: body as Record<string, unknown>,
      };

      const updated = await database
        .updateTable('triage_clusters')
        .set({
          ...(body.boardRecordId !== undefined
            ? { board_record_id: body.boardRecordId }
            : {}),
          ...(body.chatCardId !== undefined
            ? { chat_card_id: body.chatCardId }
            : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
          ...(body.decision !== undefined ? { decision: body.decision } : {}),
          // append at the SQL layer so concurrent patches never drop an entry
          audit: sql`audit || ${JSON.stringify([auditEntry])}::jsonb`,
          updated_at: new Date(),
        })
        .where('id', '=', clusterId)
        .returningAll()
        .executeTakeFirst();

      if (!updated) {
        return reply.code(404).send({
          code: ApiErrorCode.BadRequest,
          message: 'Cluster not found',
        });
      }

      const items = await database
        .selectFrom('triage_items')
        .selectAll()
        .where('cluster_id', '=', clusterId)
        .execute();

      return mapCluster(updated, items);
    },
  });

  done();
};
