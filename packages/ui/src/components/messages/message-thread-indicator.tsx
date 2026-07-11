import { eq, useLiveQuery } from '@tanstack/react-db';
import { MessagesSquare } from 'lucide-react';

import { LocalMessageNode } from '@colanode/client/types';
import { timeAgo } from '@colanode/core';
import { useConversation } from '@colanode/ui/contexts/conversation';
import { useWorkspace } from '@colanode/ui/contexts/workspace';
import { useLiveQuery as useClientQuery } from '@colanode/ui/hooks/use-live-query';
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
          createdBy: nodes.createdBy,
        })),
    [workspace.userId, message.id]
  );

  const interactionQuery = useClientQuery({
    type: 'node.interaction.get',
    nodeId: message.id,
    userId: workspace.userId,
  });

  const replies = repliesQuery.data ?? [];
  if (replies.length === 0) {
    return null;
  }

  const latestReply = replies[replies.length - 1];
  if (!latestReply) {
    return null;
  }

  // A reply is "unseen" if it was authored by someone else and is newer than
  // my last_seen_at on the thread root. Own replies never count as unseen, and
  // while the interaction is still loading we suppress the highlight to avoid a
  // false-positive flash (lastSeenAt is momentarily null on first render).
  const lastSeenAt = interactionQuery.data?.lastSeenAt ?? null;
  const hasUnseen =
    !interactionQuery.isLoading &&
    replies.some(
      (reply) =>
        reply.createdBy !== workspace.userId &&
        (!lastSeenAt || reply.createdAt > lastSeenAt)
    );

  return (
    <button
      type="button"
      onClick={() => {
        conversation.onOpenThread(message.id);
      }}
      className={cn(
        'mt-1 inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-1 text-xs text-primary-soft-foreground transition-colors hover:bg-primary-soft/80'
      )}
    >
      <MessagesSquare className="size-3.5" />
      <span className={cn('font-medium', hasUnseen && 'font-bold')}>
        {replies.length} replies
      </span>
      {hasUnseen && (
        <span className="size-1.5 rounded-full bg-spore" aria-label="unseen replies" />
      )}
      <span aria-hidden="true">·</span>
      <span className="font-mono text-[10px] opacity-80">{timeAgo(latestReply.createdAt)}</span>
    </button>
  );
};
