import { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';

import { database } from '@colanode/server/data/database';

export const opsProjectOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  colanode: z.object({ workspaceId: z.string().optional() }),
  admins: z.array(z.string()),
  killSwitch: z.boolean(),
});

export const triageOpsProjectsListRoute: FastifyPluginCallbackZod = (
  instance,
  _,
  done
) => {
  instance.route({
    method: 'GET',
    url: '/projects',
    schema: {
      response: {
        200: z.object({ projects: z.array(opsProjectOutputSchema) }),
      },
    },
    handler: async () => {
      const rows = await database
        .selectFrom('triage_projects')
        .select(['id', 'name', 'colanode', 'admins', 'kill_switch'])
        .orderBy('id')
        .execute();

      return {
        projects: rows.map((row) => ({
          id: row.id,
          name: row.name,
          colanode: row.colanode,
          admins: row.admins,
          killSwitch: row.kill_switch,
        })),
      };
    },
  });

  done();
};
