import { useMemo } from 'react';

import type { JSONContent } from '@tiptap/core';
import { buildEditorContent } from '@colanode/client/lib';
import type { RichTextContent } from '@colanode/core';
import { YDoc } from '@colanode/crdt';
import { useCurrentWorkspace } from '@colanode/mobile/session/current-workspace-context';
import { useLiveQuery } from '@colanode/ui/hooks/use-live-query';

// Reconstructs a page's rich-text document from its base64 Yjs snapshot plus
// incremental updates — the exact data path the web `document-editor.tsx` uses
// (`buildYDoc`). Both queries are live (`checkForChanges`), so the returned
// blocks re-derive whenever the document changes anywhere. M7's edit mode keys
// off this same hook.
export const useDocumentContent = (
  nodeId: string
): { blocks: JSONContent[]; isPending: boolean } => {
  const { workspace } = useCurrentWorkspace();
  const stateQuery = useLiveQuery({
    type: 'document.state.get',
    documentId: nodeId,
    userId: workspace.userId,
  });
  const updatesQuery = useLiveQuery({
    type: 'document.updates.list',
    documentId: nodeId,
    userId: workspace.userId,
  });

  const blocks = useMemo(() => {
    if (stateQuery.isPending || updatesQuery.isPending) return [];
    const ydoc = new YDoc(stateQuery.data?.state);
    for (const update of updatesQuery.data ?? []) {
      ydoc.applyUpdate(update.data);
    }
    const content = buildEditorContent(
      nodeId,
      ydoc.getObject<RichTextContent>()
    );
    return content.content ?? [];
  }, [
    nodeId,
    stateQuery.data,
    stateQuery.isPending,
    updatesQuery.data,
    updatesQuery.isPending,
  ]);

  return {
    blocks,
    isPending: stateQuery.isPending || updatesQuery.isPending,
  };
};
