import { FastifyInstance } from 'fastify';
import { beforeAll, describe, expect, it } from 'vitest';

import { database } from '@colanode/server/data/database';

import { buildMultipart } from './triage-ingest.test';
import { buildTestApp } from '../helpers/app';


describe('GET /client/v1/triage/artifacts/:reportId/:artifactId', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
    await database
      .insertInto('triage_projects')
      .values({ id: 'art-a', name: 'art-a', ingest_token: 'tok-art-a' })
      .onConflict((oc) => oc.column('id').doNothing())
      .execute();
  });

  it('streams an uploaded artifact back', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    const { payload, headers } = buildMultipart({ title: 'a' }, [
      {
        field: 'screenshot',
        filename: 's.png',
        contentType: 'image/png',
        data: png,
      },
    ]);
    const ingest = await app.inject({
      method: 'POST',
      url: '/client/v1/triage/ingest',
      payload,
      headers: { ...headers, authorization: 'Bearer tok-art-a' },
    });
    expect(ingest.statusCode).toBe(200);
    const { id } = ingest.json() as { id: string };

    const report = await database
      .selectFrom('triage_reports')
      .select(['artifacts'])
      .where('id', '=', id)
      .executeTakeFirstOrThrow();
    const artifactId = report.artifacts[0]!.id;

    const res = await app.inject({
      method: 'GET',
      url: `/client/v1/triage/artifacts/${id}/${artifactId}`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.rawPayload.equals(png)).toBe(true);
  });

  it('404s for an unknown artifact', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/client/v1/triage/artifacts/00000000-0000-0000-0000-000000000000/00000000-0000-0000-0000-000000000001`,
    });
    expect(res.statusCode).toBe(404);
  });
});
