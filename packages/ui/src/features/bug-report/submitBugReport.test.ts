import { afterEach, describe, expect, it, vi } from 'vitest';

import { submitBugReport } from './submitBugReport';

const note = {
  userId: 'u1',
  workspaceId: 'ws1',
  title: 'Setings typo',
  did: 'clicked sidebar',
  expected: 'Settings',
  got: 'Setings??',
};

describe('features/bug-report/submitBugReport', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    // @ts-expect-error test cleanup
    delete window.colanode;
  });

  it('calls executeMutation with a bugReport.create payload and maps the issue url', async () => {
    const executeMutation = vi
      .fn()
      .mockResolvedValue({ success: true, issueUrl: 'http://x/1', issueNumber: 1 });
    // @ts-expect-error partial stub for test
    window.colanode = { executeMutation };

    const result = await submitBugReport([], note);

    expect(executeMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'bugReport.create',
        userId: 'u1',
        workspaceId: 'ws1',
        title: 'Setings typo',
        pins: [],
      })
    );
    expect(result).toEqual({ success: true, issueUrl: 'http://x/1' });
  });

  it('returns a failure result (keeping pins for retry) when the mutation throws', async () => {
    const executeMutation = vi.fn().mockRejectedValue(new Error('token revoked'));
    // @ts-expect-error partial stub for test
    window.colanode = { executeMutation };

    const result = await submitBugReport([], note);
    expect(result).toEqual({ success: false, error: 'token revoked' });
  });
});
