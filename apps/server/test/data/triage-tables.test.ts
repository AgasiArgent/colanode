import { describe, expect, it } from 'vitest';

import { database } from '@colanode/server/data/database';

describe('triage tables', () => {
  it('round-trips a project, report, cluster and item', async () => {
    await database
      .insertInto('triage_projects')
      .values({
        id: 'proj-rt',
        name: 'Round Trip',
        ingest_token: 'tok-rt',
        admins: JSON.stringify(['andrey@example.com']),
      })
      .execute();

    const report = await database
      .insertInto('triage_reports')
      .values({
        project_id: 'proj-rt',
        source_adapter: 'test',
        reporter_name: 'Tester',
        title: 'Broken button',
        page_url: '/invoices',
        pins: JSON.stringify([{ comment: 'does nothing' }]),
        debug_context: JSON.stringify({}),
        artifacts: JSON.stringify([]),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    expect(report.status).toBe('new');

    const cluster = await database
      .insertInto('triage_clusters')
      .values({ project_id: 'proj-rt', root_hypothesis: 'onSave binding' })
      .returningAll()
      .executeTakeFirstOrThrow();

    expect(cluster.status).toBe('open');

    const item = await database
      .insertInto('triage_items')
      .values({
        report_id: report.id,
        project_id: 'proj-rt',
        kind: 'pin',
        summary: 'does nothing',
        source_ref: JSON.stringify({ page: '/invoices' }),
        cluster_id: cluster.id,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    expect(item.status).toBe('new');
    expect(item.audit).toEqual([]);
  });

  it('rejects an invalid decision value', async () => {
    await database
      .insertInto('triage_projects')
      .values({ id: 'proj-chk', name: 'Chk', ingest_token: 'tok-chk' })
      .execute();
    const report = await database
      .insertInto('triage_reports')
      .values({ project_id: 'proj-chk' })
      .returningAll()
      .executeTakeFirstOrThrow();

    await expect(
      database
        .insertInto('triage_items')
        .values({
          report_id: report.id,
          project_id: 'proj-chk',
          kind: 'pin',
          decision: 'wontfix' as never,
        })
        .execute()
    ).rejects.toThrow();
  });
});
