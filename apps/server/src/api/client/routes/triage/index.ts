import multipart from '@fastify/multipart';
import { FastifyPluginCallback } from 'fastify';

import { triageIngestAuthenticator } from '@colanode/server/api/client/plugins/triage-ingest-auth';

import { triageIngestRoute } from './ingest-create';

export const triageRoutes: FastifyPluginCallback = (instance, _, done) => {
  instance.register((subInstance) => {
    subInstance.register(multipart, {
      limits: { fileSize: 50 * 1024 * 1024, files: 5 },
    });
    subInstance.register(triageIngestAuthenticator);
    subInstance.register(triageIngestRoute);
  });

  done();
};
