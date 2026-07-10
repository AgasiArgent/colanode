import { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';

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
      response: { 200: opsProjectOutputSchema },
    },
    handler: async (request) => {
      const { projectId } = request.params;
      const body = request.body;

      const existing = await database
        .selectFrom('triage_projects')
        .select(['id'])
        .where('id', '=', projectId)
        .executeTakeFirst();

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
              ingest_token: body.ingestToken ?? '',
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
