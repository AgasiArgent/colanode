import { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';

import { database } from '@colanode/server/data/database';

// The bot's projection map: where a project lands in Colanode, plus the
// generated ids it must reuse to address the fields/options it created.
// Every key is optional so a partially-projected project round-trips.
export const opsProjectColanodeSchema = z.object({
  workspaceId: z.string().optional(),
  spaceId: z.string().optional(),
  databaseId: z.string().optional(),
  channelId: z.string().optional(),
  fields: z.record(z.string(), z.string()).optional(),
  decisionOptions: z.record(z.string(), z.string()).optional(),
});

export const opsProjectOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  colanode: opsProjectColanodeSchema,
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
