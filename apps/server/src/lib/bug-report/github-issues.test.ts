import { afterEach, describe, expect, it, vi } from 'vitest';

import { createGithubIssue } from './github-issues';

describe('lib/bug-report/github-issues', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.BUG_REPORT_GH_TOKEN;
    delete process.env.BUG_REPORT_GH_REPO;
  });

  it('POSTs an issue with the report label and returns the issue ref', async () => {
    process.env.BUG_REPORT_GH_TOKEN = 'tok';
    process.env.BUG_REPORT_GH_REPO = 'AgasiArgent/colanode';
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ html_url: 'http://x/7', number: 7 }), {
        status: 201,
      })
    );

    const out = await createGithubIssue('T', 'B');

    expect(out).toEqual({ issueUrl: 'http://x/7', issueNumber: 7 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.github.com/repos/AgasiArgent/colanode/issues');
    expect(JSON.parse((init as RequestInit).body as string).labels).toEqual([
      'report',
    ]);
  });

  it('throws loudly when the token is not configured', async () => {
    process.env.BUG_REPORT_GH_REPO = 'AgasiArgent/colanode';
    await expect(createGithubIssue('T', 'B')).rejects.toThrow(
      /BUG_REPORT_GH_REPO \/ BUG_REPORT_GH_TOKEN not configured/
    );
  });

  it('throws loudly on a non-2xx GitHub response', async () => {
    process.env.BUG_REPORT_GH_TOKEN = 'tok';
    process.env.BUG_REPORT_GH_REPO = 'AgasiArgent/colanode';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('bad credentials', { status: 401 })
    );
    await expect(createGithubIssue('T', 'B')).rejects.toThrow(
      /GitHub issue create failed: 401/
    );
  });
});
