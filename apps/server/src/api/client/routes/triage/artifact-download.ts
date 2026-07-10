import { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';

import { database } from '@colanode/server/data/database';
import { storage } from '@colanode/server/lib/storage';

// shortcut: unauthenticated capability URL (uuid pair is unguessable) —
// upgrade path: signed URLs if artifacts ever need revocation.
export const triageArtifactDownloadRoute: FastifyPluginCallbackZod = (
  instance,
  _,
  done
) => {
  instance.route({
    method: 'GET',
    url: '/artifacts/:reportId/:artifactId',
    schema: {
      params: z.object({
        // z.guid() (lenient uuid-shape) not z.uuid(): Zod v4's z.uuid()
        // enforces RFC version/variant nibbles and rejects placeholder /
        // non-v4 ids, which would 400 before the not-found 404 can fire.
        reportId: z.guid(),
        artifactId: z.guid(),
      }),
    },
    handler: async (request, reply) => {
      const { reportId, artifactId } = request.params;

      const report = await database
        .selectFrom('triage_reports')
        .select(['artifacts'])
        .where('id', '=', reportId)
        .executeTakeFirst();

      const artifact = report?.artifacts.find((a) => a.id === artifactId);
      if (!artifact) {
        return reply.code(404).send();
      }

      const { stream, contentType } = await storage.download(
        artifact.storagePath
      );
      reply.header(
        'content-type',
        artifact.contentType || contentType || 'application/octet-stream'
      );
      return reply.send(stream);
    },
  });

  done();
};
