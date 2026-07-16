import { FastifyInstance } from 'fastify';
import { beforeAll, describe, expect, it } from 'vitest';

import { database } from '@colanode/server/data/database';

import { buildTestApp } from '../helpers/app';

const OPS = { authorization: 'Bearer test-ops-token' };

const mkReport = async (projectId: string) =>
  (
    await database
      .insertInto('triage_reports')
      .values({ project_id: projectId, status: 'exploded' })
      .returning('id')
      .executeTakeFirstOrThrow()
  ).id;

const mkItem = async (projectId: string, reportId: string, status = 'triaged') =>
  (
    await database
      .insertInto('triage_items')
      .values({
        project_id: projectId,
        report_id: reportId,
        kind: 'pin',
        summary: 's',
        status,
        triage: 'bug',
      })
      .returning('id')
      .executeTakeFirstOrThrow()
  ).id;

const mkCluster = async (projectId: string) =>
  (
    await database
      .insertInto('triage_clusters')
      .values({ project_id: projectId, root_hypothesis: 'h', item_count: 1 })
      .returning('id')
      .executeTakeFirstOrThrow()
  ).id;

describe('triage ops cluster attach', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
    await database
      .insertInto('triage_projects')
      .values({ id: 'att-p', name: 'Att', ingest_token: 'tok-att-123456' })
      .onConflict((oc) => oc.column('id').doNothing())
      .execute();
  });

  it('attaches a triaged unclustered item transactionally', async () => {
    const cluster = await mkCluster('att-p');
    const report = await mkReport('att-p');
    const item = await mkItem('att-p', report);

    const res = await app.inject({
      method: 'POST',
      url: `/client/v1/triage/ops/clusters/${cluster}/attach`,
      headers: OPS,
      payload: {
        projectId: 'att-p',
        itemIds: [item],
        confidence: 0.95,
        reason: 'same trigger, same error signature',
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ id: cluster, itemCount: 2 });

    const row = await database
      .selectFrom('triage_items')
      .select(['cluster_id', 'status'])
      .where('id', '=', item)
      .executeTakeFirstOrThrow();
    expect(row.cluster_id).toBe(cluster);
    expect(row.status).toBe('clustered');
  });

  it('rejects attach to a terminal (Linear-completed) cluster', async () => {
    const cluster = await mkCluster('att-p');
    await database
      .insertInto('triage_linear_issues')
      .values({
        cluster_id: cluster,
        issue_id: 'x',
        state_type: 'completed',
      })
      .execute();
    // fresh sync so freshness is not the reason for rejection
    await database
      .insertInto('triage_linear_sync_state')
      .values({ project_id: 'att-p', last_success_at: new Date() })
      .onConflict((oc) =>
        oc.column('project_id').doUpdateSet({ last_success_at: new Date() })
      )
      .execute();
    const report = await mkReport('att-p');
    const item = await mkItem('att-p', report);

    const res = await app.inject({
      method: 'POST',
      url: `/client/v1/triage/ops/clusters/${cluster}/attach`,
      headers: OPS,
      payload: { projectId: 'att-p', itemIds: [item], confidence: 0.95, reason: 'r' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.body).toContain('terminal');
  });

  it('rejects attach to a projected cluster when Linear sync is stale', async () => {
    const cluster = await mkCluster('att-p');
    await database
      .insertInto('triage_linear_issues')
      .values({ cluster_id: cluster, issue_id: 'y', state_type: 'unstarted' })
      .execute();
    await database
      .updateTable('triage_linear_sync_state')
      .set({ last_success_at: new Date(Date.now() - 24 * 60 * 60 * 1000) })
      .where('project_id', '=', 'att-p')
      .execute();
    const report = await mkReport('att-p');
    const item = await mkItem('att-p', report);

    const res = await app.inject({
      method: 'POST',
      url: `/client/v1/triage/ops/clusters/${cluster}/attach`,
      headers: OPS,
      payload: { projectId: 'att-p', itemIds: [item], confidence: 0.95, reason: 'r' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.body).toContain('stale');
  });

  it('rejects already-clustered items', async () => {
    const cluster = await mkCluster('att-p');
    const report = await mkReport('att-p');
    const item = await mkItem('att-p', report, 'clustered');

    const res = await app.inject({
      method: 'POST',
      url: `/client/v1/triage/ops/clusters/${cluster}/attach`,
      headers: OPS,
      payload: { projectId: 'att-p', itemIds: [item], confidence: 0.95, reason: 'r' },
    });
    expect(res.statusCode).toBe(400);
  });
});
