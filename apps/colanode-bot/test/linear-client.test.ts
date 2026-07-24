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
    const fetchMock = vi.fn().mockResolvedValueOnce(
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
      .mockResolvedValueOnce(gqlErrors(['conflict on insert of Issue']))
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
    const assetUrl = await api.uploadFile(
      new Uint8Array([1]),
      'image/png',
      'a.png'
    );
    expect(assetUrl).toBe('https://uploads.linear.app/a.png');
    const putCall = fetchMock.mock.calls[1]!;
    expect(putCall[0]).toBe('https://up.example/put');
    expect((putCall[1] as RequestInit).method).toBe('PUT');
  });

  it('lists every issue in the requested state with its comments', async () => {
    const issue = (identifier: string, commentId: string) => ({
      id: `issue-${identifier}`,
      identifier,
      title: `Title ${identifier}`,
      url: `https://linear.app/issue/${identifier}`,
      state: { name: 'Approved for fix', type: 'unstarted' },
      comments: {
        nodes: [
          {
            id: commentId,
            body: `comment ${commentId}`,
            createdAt: '2026-07-24T10:00:00.000Z',
          },
        ],
        pageInfo: { hasNextPage: false },
      },
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        gql({
          issues: {
            nodes: [issue('KVO-108', 'comment-1')],
            pageInfo: { hasNextPage: true, endCursor: 'opaque-cursor' },
          },
        })
      )
      .mockResolvedValueOnce(
        gql({
          issues: {
            nodes: [issue('KVO-109', 'comment-2')],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    const api = new LinearApi('key');
    const issues = await api.issuesByState('team-1', 'Approved for fix');

    expect(issues).toEqual([
      {
        id: 'issue-KVO-108',
        identifier: 'KVO-108',
        title: 'Title KVO-108',
        url: 'https://linear.app/issue/KVO-108',
        stateName: 'Approved for fix',
        comments: [
          {
            id: 'comment-1',
            body: 'comment comment-1',
            createdAt: '2026-07-24T10:00:00.000Z',
          },
        ],
      },
      {
        id: 'issue-KVO-109',
        identifier: 'KVO-109',
        title: 'Title KVO-109',
        url: 'https://linear.app/issue/KVO-109',
        stateName: 'Approved for fix',
        comments: [
          {
            id: 'comment-2',
            body: 'comment comment-2',
            createdAt: '2026-07-24T10:00:00.000Z',
          },
        ],
      },
    ]);
    const secondRequest = JSON.parse(
      String((fetchMock.mock.calls[1]![1] as RequestInit).body)
    );
    expect(secondRequest.variables.after).toBe('opaque-cursor');
  });

  it('creates a marked comment and returns its server timestamp', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      gql({
        commentCreate: {
          success: true,
          comment: {
            id: 'comment-1',
            body: '@Codex fix this\n<!-- marker -->',
            createdAt: '2026-07-24T10:01:02.000Z',
          },
        },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const api = new LinearApi('key');
    const comment = await api.createComment(
      'issue-1',
      '@Codex fix this\n<!-- marker -->'
    );

    expect(comment).toEqual({
      id: 'comment-1',
      body: '@Codex fix this\n<!-- marker -->',
      createdAt: '2026-07-24T10:01:02.000Z',
    });
    const request = JSON.parse(
      String((fetchMock.mock.calls[0]![1] as RequestInit).body)
    );
    expect(request.variables).toEqual({
      input: {
        issueId: 'issue-1',
        body: '@Codex fix this\n<!-- marker -->',
      },
    });
  });

  it('resolves and applies the named review state', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        gql({
          team: {
            states: {
              nodes: [
                {
                  id: 'approved-state',
                  name: 'Approved for fix',
                  type: 'unstarted',
                },
                {
                  id: 'review-state',
                  name: 'In Review',
                  type: 'started',
                },
              ],
            },
          },
        })
      )
      .mockResolvedValueOnce(gql({ issueUpdate: { success: true } }));
    vi.stubGlobal('fetch', fetchMock);

    const api = new LinearApi('key');
    const state = await api.workflowStateByName('team-1', 'In Review');
    expect(state).toEqual({
      id: 'review-state',
      name: 'In Review',
      type: 'started',
    });

    await api.updateIssueState('issue-1', state!.id);
    const updateRequest = JSON.parse(
      String((fetchMock.mock.calls[1]![1] as RequestInit).body)
    );
    expect(updateRequest.variables).toEqual({
      id: 'issue-1',
      input: { stateId: 'review-state' },
    });
  });
});
