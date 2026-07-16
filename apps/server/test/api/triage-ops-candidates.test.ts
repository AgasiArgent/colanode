import { FastifyInstance } from 'fastify';
import { beforeAll, describe, expect, it } from 'vitest';

import { database } from '@colanode/server/data/database';

import { buildTestApp } from '../helpers/app';

const OPS = { authorization: 'Bearer test-ops-token' };

describe('triage ops cluster candidates', () => {
  let app: FastifyInstance;
  let activeId: string;
  let terminalId: string;

  beforeAll(async () => {
    app = await buildTestApp();
    await database
      .insertInto('triage_projects')
      .values({ id: 'cand-p', name: 'Cand', ingest_token: 'tok-cand-123456' })
      .onConflict((oc) => oc.column('id').doNothing())
      .execute();

    const mk = async (hypothesis: string) =>
      (
        await database
          .insertInto('triage_clusters')
          .values({ project_id: 'cand-p', root_hypothesis: hypothesis })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;

    activeId = await mk('stale total after discount');
    terminalId = await mk('old fixed bug');
    await database
      .insertInto('triage_linear_issues')
      .values({
        cluster_id: terminalId,
        issue_id: 'ext-1',
        identifier: 'KVO-9',
        state_type: 'completed',
      })
      .execute();
  });

  it('lists candidates with lifecycle derived from Linear state', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/client/v1/triage/ops/clusters/candidates?projectId=cand-p&limit=10',
      headers: OPS,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      candidates: { id: string; lifecycle: string; linearIdentifier: string | null }[];
      nextCursor: string | null;
    };
    const active = body.candidates.find((c) => c.id === activeId);
    const terminal = body.candidates.find((c) => c.id === terminalId);
    expect(active?.lifecycle).toBe('active');
    expect(terminal?.lifecycle).toBe('terminal');
    expect(terminal?.linearIdentifier).toBe('KVO-9');
  });

  it('paginates with a cursor', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/client/v1/triage/ops/clusters/candidates?projectId=cand-p&limit=1',
      headers: OPS,
    });
    const body = res.json() as { candidates: unknown[]; nextCursor: string | null };
    expect(body.candidates).toHaveLength(1);
    expect(body.nextCursor).not.toBeNull();
  });
});
