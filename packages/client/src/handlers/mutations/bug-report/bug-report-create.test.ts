import { describe, expect, it, vi } from 'vitest';

import { BugReportCreateMutationHandler } from './bug-report-create';

function makeApp(post: ReturnType<typeof vi.fn>) {
  return {
    getWorkspace: () => ({
      workspace: { workspaceId: 'ws1' },
      account: { client: { post } },
    }),
  } as never;
}

describe('BugReportCreateMutationHandler', () => {
  it('POSTs the report to the workspace bug-report route and returns the issue ref', async () => {
    const json = vi
      .fn()
      .mockResolvedValue({ success: true, issueUrl: 'http://x/1', issueNumber: 1 });
    const post = vi.fn().mockReturnValue({ json });
    const handler = new BugReportCreateMutationHandler(makeApp(post));

    const out = await handler.handleMutation({
      type: 'bugReport.create',
      userId: 'u1',
      workspaceId: 'ws1',
      title: 'Setings typo',
      did: 'clicked sidebar',
      expected: 'Settings',
      got: 'Setings??',
      pins: [],
      debugContext: {
        url: 'http://x',
        title: 't',
        userAgent: 'ua',
        screenSize: '1x1',
        consoleErrors: [],
        collectedAt: 'now',
      },
    });

    expect(post).toHaveBeenCalledWith('v1/workspaces/ws1/bug-report', {
      json: expect.objectContaining({ title: 'Setings typo', got: 'Setings??' }),
    });
    expect(out).toEqual({ success: true, issueUrl: 'http://x/1', issueNumber: 1 });
  });
});
