import { Editor, FocusPosition } from '@tiptap/core';

import { LocalNode } from '@colanode/client/types';
import { DocumentEditor } from '@colanode/ui/components/documents/document-editor';
import { useWorkspace } from '@colanode/ui/contexts/workspace';
import { useLiveQuery } from '@colanode/ui/hooks/use-live-query';

interface DocumentProps {
  node: LocalNode;
  canEdit: boolean;
  autoFocus?: FocusPosition;
  onEditorCreate?: (editor: Editor) => void;
}

export const Document = ({
  node,
  canEdit,
  autoFocus,
  onEditorCreate,
}: DocumentProps) => {
  const workspace = useWorkspace();

  const documentStateQuery = useLiveQuery({
    type: 'document.state.get',
    documentId: node.id,
    userId: workspace.userId,
  });

  const documentUpdatesQuery = useLiveQuery({
    type: 'document.updates.list',
    documentId: node.id,
    userId: workspace.userId,
  });

  if (documentStateQuery.isPending || documentUpdatesQuery.isPending) {
    return null;
  }

  const state = documentStateQuery.data ?? null;
  const updates = documentUpdatesQuery.data ?? [];

  return (
    <DocumentEditor
      key={node.id}
      node={node}
      state={state}
      updates={updates}
      canEdit={canEdit}
      // eslint-disable-next-line jsx-a11y/no-autofocus -- intentional: primary field (document title/content) focused when the containing page/record is opened
      autoFocus={autoFocus}
      onEditorCreate={onEditorCreate}
    />
  );
};
