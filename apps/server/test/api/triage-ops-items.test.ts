import { FastifyInstance } from 'fastify';
import { beforeAll, describe, expect, it } from 'vitest';

import { database } from '@colanode/server/data/database';

import { buildTestApp } from '../helpers/app';

const OPS = { authorization: 'Bearer test-ops-token' };

/**
 * The sweep's RESUME path.
 *
 * `explode` flips a report to `exploded` immediately. A sweep that only ever
 * looked at `reports?status=new` therefore stranded its items forever whenever a
 * run died between explode and triage/cluster (LLM timeout, rate limit, crash) —
 * the tester's bug vanished silently. Shipped that way once; these tests exist so
 * it cannot come back.
 */
describe('triage ops items list (sweep resume path)', () => {
  let app: FastifyInstance;
  let strandedItemId: string;
  let triagedItemId: string;

  beforeAll(async () => {
    app = await buildTestApp();

    await database
      .insertInto('triage_projects')
      .values({
        id: 'resume-p',
        name: 'Resume',
        ingest_token: 'tok-resume',
      })
      .onConflict((oc) => oc.column('id').doNothing())
      .execute();

    // A report already marked `exploded` — i.e. a previous run got this far and
    // then died. Its item is untriaged and would never be seen again.
    const report = await database
      .insertInto('triage_reports')
      .values({
        project_id: 'resume-p',
        title: 'stranded',
        status: 'exploded',
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    const stranded = await database
      .insertInto('triage_items')
      .values({
        report_id: report.id,
        project_id: 'resume-p',
        kind: 'pin',
        summary: 'stranded item',
        status: 'new',
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    strandedItemId = stranded.id;

    // A triaged-but-unclustered item — the clustering stage's queue.
    const triaged = await database
      .insertInto('triage_items')
      .values({
        report_id: report.id,
        project_id: 'resume-p',
        kind: 'pin',
        summary: 'triaged item',
        status: 'triaged',
        triage: 'bug',
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    triagedItemId = triaged.id;
  });

  it('finds an untriaged item whose report is already exploded', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/client/v1/triage/ops/items?status=new&projectId=resume-p',
      headers: OPS,
    });

    expect(res.statusCode).toBe(200);
    const { items } = res.json() as { items: Array<{ id: string }> };
    expect(items.map((item) => item.id)).toContain(strandedItemId);
  });

  it('finds triaged items awaiting clustering', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/client/v1/triage/ops/items?status=triaged&unclustered=true&projectId=resume-p',
      headers: OPS,
    });

    expect(res.statusCode).toBe(200);
    const { items } = res.json() as { items: Array<{ id: string }> };
    expect(items.map((item) => item.id)).toContain(triagedItemId);
  });

  it('requires the ops service token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/client/v1/triage/ops/items?status=new',
      headers: { authorization: 'Bearer wrong' },
    });
    expect(res.statusCode).toBe(401);
  });
});
