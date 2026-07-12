import { useEffect, useRef, useState } from 'react';

import { useWorkspace } from '@colanode/ui/contexts/workspace';

import { installErrorInterceptors } from './debugContext';
import {
  createElementCapture,
  withElementCapture,
} from './elementCapture';
import { createPinSender } from './pinSender';
import { createBippyPinEnricher } from './pinSource';
import { submitBugReport, type BugNote } from './submitBugReport';

/**
 * Always-on pinpoint bug-report launcher — no role gate. Mounted inside
 * WorkspaceContext so it has { userId, workspaceId }; any authenticated
 * workspace member sees it. The pinpoint overlay's own native toolbar (fixed
 * bottom-right) is the pin launcher; this component adds an offset note panel
 * (title/did/expected/got) whose current values are read at submit time via a
 * ref (pinpoint calls sendToAgent from its own UI).
 */
export const BugReportWidget = () => {
  const workspace = useWorkspace();

  const [note, setNote] = useState({
    title: '',
    did: '',
    expected: '',
    got: '',
  });
  const noteRef = useRef<BugNote>({
    userId: workspace.userId,
    workspaceId: workspace.workspaceId,
    ...note,
  });
  noteRef.current = { userId: workspace.userId, workspaceId: workspace.workspaceId, ...note };

  useEffect(() => {
    installErrorInterceptors();

    let disposed = false;
    let dispose: (() => void) | undefined;
    const capture = createElementCapture(document);

    (async () => {
      const { mountPinpoint, MemoryStore } = await import(
        '@agent-native/pinpoint'
      );
      if (disposed) return;
      const store = withElementCapture(new MemoryStore(), capture);
      const result = mountPinpoint({
        storage: store,
        autoSubmit: false,
        includeSourcePaths: true,
        clearOnSend: true,
        sendToAgent: createPinSender({
          store,
          submit: (pins) => submitBugReport(pins, noteRef.current),
          enrich: createBippyPinEnricher(capture),
        }),
      });
      dispose = result.dispose;
    })();

    return () => {
      disposed = true;
      capture.dispose();
      dispose?.();
    };
  }, [workspace.userId, workspace.workspaceId]);

  const field = (key: keyof typeof note, label: string) => (
    <input
      aria-label={label}
      placeholder={label}
      value={note[key]}
      onChange={(e) => setNote((n) => ({ ...n, [key]: e.target.value }))}
      className="w-full rounded border px-2 py-1 text-sm"
    />
  );

  return (
    <div
      data-testid="bug-report-panel"
      className="fixed bottom-4 left-4 z-[2147483645] flex w-64 flex-col gap-1 rounded-md border bg-white p-2 shadow-lg"
    >
      <span className="text-xs font-medium text-gray-500">Bug report</span>
      {field('title', 'Title')}
      {field('did', 'What you did')}
      {field('expected', 'Expected')}
      {field('got', 'Got')}
      <span className="text-[10px] text-gray-400">
        Pin the broken element, then use pinpoint&apos;s Send.
      </span>
    </div>
  );
};
