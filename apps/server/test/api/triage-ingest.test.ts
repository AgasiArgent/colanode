import { FastifyInstance } from 'fastify';
import { beforeAll, describe, expect, it } from 'vitest';

import { database } from '@colanode/server/data/database';

import { buildTestApp } from '../helpers/app';

export const buildMultipart = (
  report: object,
  files: Array<{
    field: string;
    filename: string;
    contentType: string;
    data: Buffer;
  }> = []
) => {
  const boundary = '----triagetestboundary';
  const parts: Buffer[] = [
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="report"\r\n\r\n${JSON.stringify(report)}\r\n`
    ),
  ];
  for (const f of files) {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${f.field}"; filename="${f.filename}"\r\nContent-Type: ${f.contentType}\r\n\r\n`
      ),
      f.data,
      Buffer.from('\r\n')
    );
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  return {
    payload: Buffer.concat(parts),
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  };
};

const seedProject = async (id: string) => {
  await database
    .insertInto('triage_projects')
    .values({ id, name: id, ingest_token: `tok-${id}` })
    .onConflict((oc) => oc.column('id').doNothing())
    .execute();
  return `tok-${id}`;
};

describe('POST /client/v1/triage/ingest', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  it('rejects a missing token', async () => {
    const { payload, headers } = buildMultipart({ title: 'x' });
    const res = await app.inject({
      method: 'POST',
      url: '/client/v1/triage/ingest',
      payload,
      headers,
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects an unknown token', async () => {
    const { payload, headers } = buildMultipart({ title: 'x' });
    const res = await app.inject({
      method: 'POST',
      url: '/client/v1/triage/ingest',
      payload,
      headers: { ...headers, authorization: 'Bearer nope' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('stores a report with an artifact file', async () => {
    const token = await seedProject('ing-a');
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const { payload, headers } = buildMultipart(
      {
        sourceAdapter: 'kvota-pin',
        title: 'Save button dead',
        reporter: { id: 'u1', name: 'Tester' },
        did: 'clicked save',
        expected: 'saved',
        got: 'nothing',
        pageUrl: '/invoices',
        pins: [{ comment: 'кнопка не работает', sourceFile: 'src/App.tsx:10' }],
        debugContext: { shortId: 'FB-1' },
      },
      [{ field: 'screenshot', filename: 's.png', contentType: 'image/png', data: png }]
    );
    const res = await app.inject({
      method: 'POST',
      url: '/client/v1/triage/ingest',
      payload,
      headers: { ...headers, authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const { id } = res.json() as { id: string };

    const row = await database
      .selectFrom('triage_reports')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirstOrThrow();
    expect(row.project_id).toBe('ing-a');
    expect(row.title).toBe('Save button dead');
    expect(row.pins).toHaveLength(1);
    expect(row.artifacts).toHaveLength(1);
    expect(row.artifacts[0]!.kind).toBe('screenshot');
    expect(row.status).toBe('new');
  });

  it('rejects an executable artifact content type (stored-XSS guard)', async () => {
    const token = await seedProject('ing-xss');
    const { payload, headers } = buildMultipart({ title: 'evil' }, [
      {
        field: 'screenshot',
        filename: 'evil.html',
        contentType: 'text/html',
        data: Buffer.from('<script>alert(1)</script>'),
      },
    ]);
    const res = await app.inject({
      method: 'POST',
      url: '/client/v1/triage/ingest',
      payload,
      headers: { ...headers, authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(400);
  });

  it('blocks ingest when the project kill switch is on', async () => {
    const token = await seedProject('ing-killed');
    await database
      .updateTable('triage_projects')
      .set({ kill_switch: true })
      .where('id', '=', 'ing-killed')
      .execute();
    const { payload, headers } = buildMultipart({ title: 'x' });
    const res = await app.inject({
      method: 'POST',
      url: '/client/v1/triage/ingest',
      payload,
      headers: { ...headers, authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('rejects a body without the report field', async () => {
    const token = await seedProject('ing-b');
    const { payload, headers } = buildMultipart({ title: 'ignored' }, []);
    // strip the report part by sending an empty multipart
    const boundary = '----emptyboundary';
    const res = await app.inject({
      method: 'POST',
      url: '/client/v1/triage/ingest',
      payload: Buffer.from(`--${boundary}--\r\n`),
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
        authorization: `Bearer ${token}`,
      },
    });
    expect(res.statusCode).toBe(400);
    void payload;
    void headers;
  });
});
