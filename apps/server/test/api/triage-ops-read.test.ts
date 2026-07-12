import { FastifyInstance } from 'fastify';
import { beforeAll, describe, expect, it } from 'vitest';

import { database } from '@colanode/server/data/database';

import { buildTestApp } from '../helpers/app';

const OPS = { authorization: 'Bearer test-ops-token' };

describe('triage ops read routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
    await database
      .insertInto('triage_projects')
      .values({
        id: 'ops-a',
        name: 'Ops A',
        ingest_token: 'tok-ops-a',
        admins: JSON.stringify(['andrey@example.com']),
      })
      .onConflict((oc) => oc.column('id').doNothing())
      .execute();
    await database
      .insertInto('triage_reports')
      .values({ project_id: 'ops-a', title: 'r1' })
      .execute();
  });

  it('rejects a wrong ops token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/client/v1/triage/ops/projects',
      headers: { authorization: 'Bearer wrong' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('lists projects without leaking ingest tokens', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/client/v1/triage/ops/projects',
      headers: OPS,
    });
    expect(res.statusCode).toBe(200);
    const { projects } = res.json() as {
      projects: Array<Record<string, unknown>>;
    };
    const project = projects.find((p) => p.id === 'ops-a')!;
    expect(project.killSwitch).toBe(false);
    expect(project.admins).toEqual(['andrey@example.com']);
    expect(res.body).not.toContain('tok-ops-a');
  });

  it('lists new reports for a project', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/client/v1/triage/ops/reports?status=new&projectId=ops-a',
      headers: OPS,
    });
    expect(res.statusCode).toBe(200);
    const { reports } = res.json() as {
      reports: Array<{ title: string; status: string }>;
    };
    expect(reports.some((r) => r.title === 'r1')).toBe(true);
    expect(reports.every((r) => r.status === 'new')).toBe(true);
  });

  it('lists open clusters with items', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/client/v1/triage/ops/clusters?projectId=ops-a',
      headers: OPS,
    });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { clusters: unknown[] }).clusters).toEqual([]);
  });
});
