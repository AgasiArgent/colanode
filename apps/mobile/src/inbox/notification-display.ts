import type { LocalNode, User } from '@colanode/client/types';

const LABELS: Record<string, string> = {
  mention: 'mentioned you',
  direct_message: 'sent you a message',
  task_assigned: 'assigned you a task',
  task_status: 'updated a task',
};

export const notificationLabel = (type: string): string =>
  LABELS[type] ?? 'sent a notification';

const MONTHS = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
];

export const formatRelativeTime = (iso: string, now: Date): string => {
  const then = new Date(iso);
  const diffMs = now.getTime() - then.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days <= 7) return `${days}d`;
  return `${MONTHS[then.getUTCMonth()]} ${then.getUTCDate()}`;
};

// Chats are unnamed — their title is the other collaborator; channels carry a
// name attribute. Mirrors how the chat list derives titles (chat-list-item).
export const conversationTitle = (
  node: LocalNode | undefined,
  users: User[],
  ownUserId: string
): string => {
  if (!node) return 'Conversation';
  if (node.type === 'chat') {
    const counterpartId = Object.keys(node.collaborators ?? {}).find(
      (id) => id !== ownUserId
    );
    return users.find((user) => user.id === counterpartId)?.name ?? 'Chat';
  }
  const name = (node as { name?: string | null }).name;
  return name && name.length > 0 ? name : 'Conversation';
};
