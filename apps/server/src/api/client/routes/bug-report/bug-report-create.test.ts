import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@colanode/server/data/database', () => ({
  database: {
    selectFrom: () => ({
      select: () => ({
        where: () => ({
          executeTakeFirst: async () => ({ name: 'Ivan Tester' }),
        }),
      }),
    }),
    // test/setup-env.ts's shared afterAll re-imports this same aliased module
    // path and calls destroy() on it during teardown; the mock must satisfy
    // that shape too, not just the shape this test exercises directly.
    destroy: async () => undefined,
  },
}));

vi.mock('@colanode/server/lib/bug-report/github-issues', () => ({
  createGithubIssue: vi
    .fn()
    .mockResolvedValue({ issueUrl: 'http://x/9', issueNumber: 9 }),
}));

import { bugReportCreateRoute } from './bug-report-create';

function buildApp() {
  const app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.addHook('onRequest', async (request) => {
    (request as never as { workspace: unknown }).workspace = {
      id: 'ws1',
      user: { id: 'u1', accountId: 'a1', role: 'member' },
    };
  });
  app.register(bugReportCreateRoute);
  return app;
}

const payload = {
  title: 'Setings typo',
  did: 'clicked sidebar',
  expected: 'Settings',
  got: 'Setings??',
  pins: [],
  debugContext: {
    url: 'http://x',
    title: 't',
    userAgent: 'ua',
    screenSize: '1x1',
    consoleErrors: [],
    collectedAt: 'now',
  },
};

describe('routes/bug-report POST /', () => {
  afterEach(() => vi.clearAllMocks());

  it('mints an issue for a workspace member and returns its ref', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'POST', url: '/', payload });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      success: true,
      issueUrl: 'http://x/9',
      issueNumber: 9,
    });
  });
});
