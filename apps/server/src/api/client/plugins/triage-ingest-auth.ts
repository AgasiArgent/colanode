import { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';

import { ApiErrorCode } from '@colanode/core';
import { database } from '@colanode/server/data/database';
import { SelectTriageProject } from '@colanode/server/data/schema';

declare module 'fastify' {
  interface FastifyRequest {
    triageProject: SelectTriageProject;
  }
}

const triageIngestAuthenticatorCallback: FastifyPluginCallback = (
  fastify,
  _,
  done
) => {
  if (!fastify.hasRequestDecorator('triageProject')) {
    fastify.decorateRequest('triageProject');
  }

  fastify.addHook('onRequest', async (request, reply) => {
    const auth = request.headers.authorization;
    if (!auth) {
      return reply.code(401).send({
        code: ApiErrorCode.TokenMissing,
        message: 'No token provided',
      });
    }

    const parts = auth.split(' ');
    const token = parts.length === 2 ? parts[1] : parts[0];
    if (!token) {
      return reply.code(401).send({
        code: ApiErrorCode.TokenMissing,
        message: 'No token provided',
      });
    }

    const project = await database
      .selectFrom('triage_projects')
      .selectAll()
      .where('ingest_token', '=', token)
      .executeTakeFirst();

    if (!project) {
      return reply.code(401).send({
        code: ApiErrorCode.TokenInvalid,
        message: 'Invalid ingest token',
      });
    }

    request.triageProject = project;
  });

  done();
};

export const triageIngestAuthenticator = fp(triageIngestAuthenticatorCallback);
