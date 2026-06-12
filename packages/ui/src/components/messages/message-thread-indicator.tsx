import { eq, useLiveQuery } from '@tanstack/react-db';
import { MessagesSquare } from 'lucide-react';

import { LocalMessageNode } from '@colanode/client/types';
import { timeAgo } from '@colanode/core';
import { useConversation } from '@colanode/ui/contexts/conversation';
import { useWorkspace } from '@colanode/ui/contexts/workspace';
import { cn } from '@colanode/ui/lib/utils';

interface MessageThreadIndicatorProps {
  message: LocalMessageNode;
}

export const MessageThreadIndicator = ({
  message,
}: MessageThreadIndicatorProps) => {
  const workspace = useWorkspace();
  const conversation = useConversation();

  const repliesQuery = useLiveQuery(
    (q) =>
      q
        .from({ nodes: workspace.collections.nodes })
        .where(({ nodes }) => eq(nodes.type, 'message'))
        .where(({ nodes }) => eq(nodes.parentId, message.id))
        .orderBy(({ nodes }) => nodes.createdAt, 'asc')
        .select(({ nodes }) => ({
          id: nodes.id,
          createdAt: nodes.createdAt,
        })),
    [workspace.userId, message.id]
  );

  const replies = repliesQuery.data ?? [];
  if (replies.length === 0) {
    return null;
  }

  const latestReply = replies[replies.length - 1];
  if (!latestReply) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => {
        conversation.onOpenThread(message.id);
      }}
      className={cn(
        'mt-1 inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground'
      )}
    >
      <MessagesSquare className="size-3.5" />
      <span>{replies.length} replies</span>
      <span aria-hidden="true">·</span>
      <span>{timeAgo(latestReply.createdAt)}</span>
    </button>
  );
};
