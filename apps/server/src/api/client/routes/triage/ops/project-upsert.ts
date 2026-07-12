import { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';

import { ApiErrorCode, apiErrorOutputSchema } from '@colanode/core';
import { database } from '@colanode/server/data/database';

import { opsProjectOutputSchema } from './projects-list';

const projectUpsertSchema = z.object({
  name: z.string().min(1),
  ingestToken: z.string().min(16).optional(),
  colanode: z.object({ workspaceId: z.string().optional() }).optional(),
  admins: z.array(z.string()).optional(),
  killSwitch: z.boolean().optional(),
});

export const triageOpsProjectUpsertRoute: FastifyPluginCallbackZod = (
  instance,
  _,
  done
) => {
  instance.route({
    method: 'PUT',
    url: '/projects/:projectId',
    schema: {
      params: z.object({ projectId: z.string().min(1) }),
      body: projectUpsertSchema,
      response: {
        200: opsProjectOutputSchema,
        400: apiErrorOutputSchema,
      },
    },
    handler: async (request, reply) => {
      const { projectId } = request.params;
      const body = request.body;

      const existing = await database
        .selectFrom('triage_projects')
        .select(['id'])
        .where('id', '=', projectId)
        .executeTakeFirst();

      // A project authenticates by its ingest_token (UNIQUE, non-empty). A
      // create without one would persist '' — un-authenticatable and prone to
      // collide with the next tokenless create. Require it on creation.
      if (!existing && !body.ingestToken) {
        return reply.code(400).send({
          code: ApiErrorCode.BadRequest,
          message: 'ingestToken is required when creating a project',
        });
      }

      const row = existing
        ? await database
            .updateTable('triage_projects')
            .set({
              name: body.name,
              ...(body.ingestToken ? { ingest_token: body.ingestToken } : {}),
              ...(body.colanode
                ? { colanode: JSON.stringify(body.colanode) }
                : {}),
              ...(body.admins ? { admins: JSON.stringify(body.admins) } : {}),
              ...(body.killSwitch !== undefined
                ? { kill_switch: body.killSwitch }
                : {}),
              updated_at: new Date(),
            })
            .where('id', '=', projectId)
            .returningAll()
            .executeTakeFirstOrThrow()
        : await database
            .insertInto('triage_projects')
            .values({
              id: projectId,
              name: body.name,
              ingest_token: body.ingestToken as string,
              colanode: JSON.stringify(body.colanode ?? {}),
              admins: JSON.stringify(body.admins ?? []),
              kill_switch: body.killSwitch ?? false,
            })
            .returningAll()
            .executeTakeFirstOrThrow();

      return {
        id: row.id,
        name: row.name,
        colanode: row.colanode,
        admins: row.admins,
        killSwitch: row.kill_switch,
      };
    },
  });

  done();
};
