import { afterEach, describe, expect, it, vi } from 'vitest';

import { LinearApi } from '../src/linear/client';

const gql = (data: unknown) =>
  new Response(JSON.stringify({ data }), { status: 200 });

const gqlErrors = (messages: string[]) =>
  new Response(
    JSON.stringify({ errors: messages.map((message) => ({ message })) }),
    { status: 200 }
  );

afterEach(() => vi.unstubAllGlobals());

describe('LinearApi', () => {
  it('ensureIssue is lookup-first', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        gql({
          issue: {
            id: 'c1',
            identifier: 'KVO-1',
            url: 'u',
            state: { name: 'Triage', type: 'triage' },
            description: '',
          },
        })
      );
    vi.stubGlobal('fetch', fetchMock);
    const api = new LinearApi('key');
    const issue = await api.ensureIssue({
      id: 'c1',
      teamId: 't',
      title: 'x',
      description: 'd',
      labelIds: [],
    });
    expect(issue.identifier).toBe('KVO-1');
    expect(fetchMock).toHaveBeenCalledTimes(1); // no create call
  });

  it('ensureIssue falls back to lookup when create rejects with a duplicate-id error', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(gql({ issue: null }))
      .mockResolvedValueOnce(gqlErrors(['an issue with this id already exists']))
      .mockResolvedValueOnce(
        gql({
          issue: {
            id: 'c1',
            identifier: 'KVO-1',
            url: 'u',
            state: { name: 'Triage', type: 'triage' },
            description: '',
          },
        })
      );
    vi.stubGlobal('fetch', fetchMock);
    const api = new LinearApi('key');
    const issue = await api.ensureIssue({
      id: 'c1',
      teamId: 't',
      title: 'x',
      description: 'd',
      labelIds: [],
    });
    expect(issue.identifier).toBe('KVO-1');
    expect(fetchMock).toHaveBeenCalledTimes(3); // lookup miss, failed create, re-lookup
  });

  it('uploadFile PUTs bytes to the pre-signed url and returns assetUrl', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        gql({
          fileUpload: {
            success: true,
            uploadFile: {
              uploadUrl: 'https://up.example/put',
              assetUrl: 'https://uploads.linear.app/a.png',
              headers: [{ key: 'x-meta', value: 'v' }],
            },
          },
        })
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const api = new LinearApi('key');
    const assetUrl = await api.uploadFile(new Uint8Array([1]), 'image/png', 'a.png');
    expect(assetUrl).toBe('https://uploads.linear.app/a.png');
    const putCall = fetchMock.mock.calls[1]!;
    expect(putCall[0]).toBe('https://up.example/put');
    expect((putCall[1] as RequestInit).method).toBe('PUT');
  });
});
