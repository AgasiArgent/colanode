import { eq, useLiveQuery } from '@tanstack/react-db';

import { LocalFileNode } from '@colanode/client/types';
import { formatBytes } from '@colanode/core/lib/files.js';
import { FileIcon } from '@colanode/ui/components/files/file-icon';
import { FilePreview } from '@colanode/ui/components/files/file-preview';
import { Link } from '@colanode/ui/components/ui/link';
import { useWorkspace } from '@colanode/ui/contexts/workspace';
import { canPreviewFile } from '@colanode/ui/lib/files';

interface FileBlockProps {
  id: string;
}

export const FileBlock = ({ id }: FileBlockProps) => {
  const workspace = useWorkspace();

  const fileGetQuery = useLiveQuery(
    (q) =>
      q
        .from({ nodes: workspace.collections.nodes })
        .where(({ nodes }) => eq(nodes.id, id))
        .findOne(),
    [workspace.userId, id]
  );

  if (
    fileGetQuery.isLoading ||
    !fileGetQuery.data ||
    fileGetQuery.data.type !== 'file'
  ) {
    return null;
  }

  const file = fileGetQuery.data as LocalFileNode;
  const canPreview = canPreviewFile(file.subtype);

  return (
    <Link
      from="/workspace/$userId/$nodeId"
      to="modal/$modalNodeId"
      params={{ modalNodeId: id }}
    >
      {canPreview ? (
        <div className="flex h-72 max-h-72 w-full max-w-lg cursor-pointer items-center justify-center overflow-hidden rounded-[14px] border border-border p-2 hover:bg-muted/50">
          <FilePreview file={file} />
        </div>
      ) : (
        <div className="flex w-full max-w-md cursor-pointer flex-row items-center gap-3 overflow-hidden rounded-[14px] border border-border bg-card p-3 hover:bg-accent">
          <FileIcon mimeType={file.mimeType} className="size-10" />
          <div className="flex min-w-0 flex-col gap-1">
            <div className="truncate text-sm font-medium">{file.name}</div>
            <div className="font-mono text-[11px] text-muted-foreground">
              {file.mimeType} · {formatBytes(file.size)}
            </div>
          </div>
        </div>
      )}
    </Link>
  );
};
