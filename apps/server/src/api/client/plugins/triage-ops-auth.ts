import { timingSafeEqual } from 'crypto';

import { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';

import { ApiErrorCode } from '@colanode/core';
import { config } from '@colanode/server/lib/config';

const tokensMatch = (candidate: string, expected: string): boolean => {
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

const triageOpsAuthenticatorCallback: FastifyPluginCallback = (
  fastify,
  _,
  done
) => {
  fastify.addHook('onRequest', async (request, reply) => {
    const serviceToken = config.triage.serviceToken;
    if (!serviceToken) {
      // ops-API is disabled entirely when no token is configured
      return reply.code(404).send();
    }

    const auth = request.headers.authorization;
    const parts = auth ? auth.split(' ') : [];
    const token = parts.length === 2 ? parts[1] : parts[0];

    if (!token || !tokensMatch(token, serviceToken)) {
      return reply.code(401).send({
        code: ApiErrorCode.TokenInvalid,
        message: 'Invalid service token',
      });
    }
  });

  done();
};

export const triageOpsAuthenticator = fp(triageOpsAuthenticatorCallback);
