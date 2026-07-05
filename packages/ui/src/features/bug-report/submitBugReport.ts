import type { Pin } from '@agent-native/pinpoint';

import { collectDebugContext } from './debugContext';
import { buildPinSnapshots } from './pinReport';

export interface BugNote {
  userId: string;
  workspaceId: string;
  title: string;
  did: string;
  expected: string;
  got: string;
}

export interface SubmitResult {
  success: boolean;
  issueUrl?: string;
  error?: string;
}

/** Submit the queued pins as ONE bug report via colanode's worker-side authed
 *  client (window.colanode.executeMutation is the only client→server authed
 *  path; the account token lives in the web worker, not the main thread). */
export async function submitBugReport(
  pins: Pin[],
  note: BugNote
): Promise<SubmitResult> {
  try {
    const output = await window.colanode.executeMutation({
      type: 'bugReport.create',
      userId: note.userId,
      workspaceId: note.workspaceId,
      title: note.title,
      did: note.did,
      expected: note.expected,
      got: note.got,
      pins: buildPinSnapshots(pins),
      debugContext: collectDebugContext(),
    });
    if (!output.success) return { success: false, error: 'Submit failed' };
    return { success: true, issueUrl: output.issueUrl };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}
