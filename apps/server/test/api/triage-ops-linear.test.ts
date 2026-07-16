import { FastifyInstance } from 'fastify';
import { beforeAll, describe, expect, it } from 'vitest';

import { database } from '@colanode/server/data/database';

import { buildTestApp } from '../helpers/app';

const OPS = { authorization: 'Bearer test-ops-token' };

describe('triage ops linear projection routes', () => {
  let app: FastifyInstance;
  let clusterId: string;

  beforeAll(async () => {
    app = await buildTestApp();
    await database
      .insertInto('triage_projects')
      .values({
        id: 'lp',
        name: 'LP',
        ingest_token: 'tok-lp-1234567890',
        linear: JSON.stringify({
          enabled: true,
          teamId: 'team-1',
          teamKey: 'KVO',
          cutoverAt: '2026-01-01T00:00:00Z',
        }),
      })
      .onConflict((oc) => oc.column('id').doNothing())
      .execute();
    const report = await database
      .insertInto('triage_reports')
      .values({ project_id: 'lp', status: 'exploded', title: 'T' })
      .returning('id')
      .executeTakeFirstOrThrow();
    clusterId = (
      await database
        .insertInto('triage_clusters')
        .values({ project_id: 'lp', root_hypothesis: 'h', item_count: 1 })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    await database
      .insertInto('triage_items')
      .values({
        project_id: 'lp',
        report_id: report.id,
        kind: 'pin',
        status: 'clustered',
        cluster_id: clusterId,
        triage: 'bug',
      })
      .execute();
  });

  it('queues an unprojected post-cutover cluster with its reports', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/client/v1/triage/ops/linear/queue?projectId=lp',
      headers: OPS,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      project: { id: string };
      clusters: { id: string; reports: { title: string }[]; linear: unknown }[];
    };
    const mine = body.clusters.find((c) => c.id === clusterId);
    expect(mine).toBeDefined();
    expect(mine!.reports[0]!.title).toBe('T');
    expect(mine!.linear).toBeNull();
  });

  it('records a projection result and drops the cluster from the queue', async () => {
    const put = await app.inject({
      method: 'PUT',
      url: `/client/v1/triage/ops/linear/issues/${clusterId}`,
      headers: OPS,
      payload: {
        issueId: 'iss-1',
        identifier: 'KVO-11',
        url: 'https://linear.app/x/issue/KVO-11',
        stateName: 'Triage',
        stateType: 'triage',
        artifactAssets: {},
      },
    });
    expect(put.statusCode).toBe(200);

    const res = await app.inject({
      method: 'GET',
      url: '/client/v1/triage/ops/linear/queue?projectId=lp',
      headers: OPS,
    });
    const body = res.json() as { clusters: { id: string }[] };
    expect(body.clusters.find((c) => c.id === clusterId)).toBeUndefined();
  });

  it('reconciles a duplicate decision into a local alias', async () => {
    const other = (
      await database
        .insertInto('triage_clusters')
        .values({ project_id: 'lp', root_hypothesis: 'canon' })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    await database
      .insertInto('triage_linear_issues')
      .values({ cluster_id: other, issue_id: 'iss-2', identifier: 'KVO-12' })
      .execute();

    const res = await app.inject({
      method: 'POST',
      url: '/client/v1/triage/ops/linear/reconcile',
      headers: OPS,
      payload: {
        projectId: 'lp',
        cursorTs: new Date().toISOString(),
        issues: [
          {
            issueId: 'iss-1',
            identifier: 'KVO-11',
            stateName: 'Duplicate',
            stateType: 'canceled',
            updatedAt: new Date().toISOString(),
            duplicateOfIssueId: 'iss-2',
          },
        ],
        dismissedRelations: [],
      },
    });
    expect(res.statusCode).toBe(200);

    const row = await database
      .selectFrom('triage_linear_issues')
      .selectAll()
      .where('cluster_id', '=', clusterId)
      .executeTakeFirstOrThrow();
    expect(row.canonical_cluster_id).toBe(other);

    const sync = await database
      .selectFrom('triage_linear_sync_state')
      .selectAll()
      .where('project_id', '=', 'lp')
      .executeTakeFirstOrThrow();
    expect(sync.last_success_at).not.toBeNull();
  });
});
