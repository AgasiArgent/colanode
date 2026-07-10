import { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';

import { ApiErrorCode, apiErrorOutputSchema } from '@colanode/core';
import { database } from '@colanode/server/data/database';

import { mapItem, opsItemOutputSchema } from './clusters-list';

const itemPatchSchema = z
  .object({
    triage: z.enum(['bug', 'feature', 'unclear', 'no-fly']).optional(),
    triageReason: z.string().optional(),
    confidence: z.number().min(0).max(1).optional(),
    status: z
      .enum(['new', 'triaged', 'clustered', 'decided', 'escalated'])
      .optional(),
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
    agentNote: z.string().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: 'Empty patch',
  });

export const triageOpsItemPatchRoute: FastifyPluginCallbackZod = (
  instance,
  _,
  done
) => {
  instance.route({
    method: 'PATCH',
    url: '/items/:itemId',
    schema: {
      params: z.object({ itemId: z.guid() }),
      body: itemPatchSchema,
      response: {
        200: opsItemOutputSchema,
        404: apiErrorOutputSchema,
      },
    },
    handler: async (request, reply) => {
      const { itemId } = request.params;
      const body = request.body;

      const item = await database
        .selectFrom('triage_items')
        .select(['audit'])
        .where('id', '=', itemId)
        .executeTakeFirst();

      if (!item) {
        return reply.code(404).send({
          code: ApiErrorCode.BadRequest,
          message: 'Item not found',
        });
      }

      const auditEntry = {
        at: new Date().toISOString(),
        actor: 'ops',
        changes: body as Record<string, unknown>,
      };

      const updated = await database
        .updateTable('triage_items')
        .set({
          ...(body.triage !== undefined ? { triage: body.triage } : {}),
          ...(body.triageReason !== undefined
            ? { triage_reason: body.triageReason }
            : {}),
          ...(body.confidence !== undefined
            ? { confidence: body.confidence }
            : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
          ...(body.decision !== undefined ? { decision: body.decision } : {}),
          ...(body.agentNote !== undefined
            ? { agent_note: body.agentNote }
            : {}),
          audit: JSON.stringify([...item.audit, auditEntry]),
          updated_at: new Date(),
        })
        .where('id', '=', itemId)
        .returningAll()
        .executeTakeFirstOrThrow();

      return mapItem(updated);
    },
  });

  done();
};
