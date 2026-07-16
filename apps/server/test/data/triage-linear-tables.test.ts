import { beforeAll, describe, expect, it } from 'vitest';

import { database } from '@colanode/server/data/database';

import { buildTestApp } from '../helpers/app';

describe('triage linear projection tables', () => {
  beforeAll(async () => {
    await buildTestApp();
    await database
      .insertInto('triage_projects')
      .values({ id: 'lin-t', name: 'Lin T', ingest_token: 'tok-lin-t-123456' })
      .onConflict((oc) => oc.column('id').doNothing())
      .execute();
  });

  const mkCluster = async () => {
    const row = await database
      .insertInto('triage_clusters')
      .values({ project_id: 'lin-t', root_hypothesis: 'x' })
      .returning('id')
      .executeTakeFirstOrThrow();
    return row.id;
  };

  it('stores an ordered unique relation pair and rejects self-relations', async () => {
    const a = await mkCluster();
    const b = await mkCluster();
    const [lo, hi] = [a, b].sort();

    await database
      .insertInto('triage_cluster_relations')
      .values({ project_id: 'lin-t', cluster_a_id: lo, cluster_b_id: hi, reason: 'r' })
      .execute();

    await expect(
      database
        .insertInto('triage_cluster_relations')
        .values({ project_id: 'lin-t', cluster_a_id: lo, cluster_b_id: hi, reason: 'dup' })
        .execute()
    ).rejects.toThrow(); // unique pair

    await expect(
      database
        .insertInto('triage_cluster_relations')
        .values({ project_id: 'lin-t', cluster_a_id: hi, cluster_b_id: lo, reason: 'unordered' })
        .execute()
    ).rejects.toThrow(); // ordering check (a < b)

    await expect(
      database
        .insertInto('triage_cluster_relations')
        .values({ project_id: 'lin-t', cluster_a_id: lo, cluster_b_id: lo, reason: 'self' })
        .execute()
    ).rejects.toThrow(); // self-relation
  });

  it('stores linear issue projection state keyed by cluster', async () => {
    const c = await mkCluster();
    await database
      .insertInto('triage_linear_issues')
      .values({
        cluster_id: c,
        issue_id: '9f0c…-not-checked',
        identifier: 'KVO-7',
        url: 'https://linear.app/x/issue/KVO-7',
      })
      .execute();
    const row = await database
      .selectFrom('triage_linear_issues')
      .selectAll()
      .where('cluster_id', '=', c)
      .executeTakeFirstOrThrow();
    expect(row.identifier).toBe('KVO-7');
    expect(row.artifact_assets).toEqual({});
  });

  it('keeps one sync-state row per project', async () => {
    await database
      .insertInto('triage_linear_sync_state')
      .values({ project_id: 'lin-t' })
      .onConflict((oc) => oc.column('project_id').doNothing())
      .execute();
    await expect(
      database
        .insertInto('triage_linear_sync_state')
        .values({ project_id: 'lin-t' })
        .execute()
    ).rejects.toThrow(); // pk
  });
});
