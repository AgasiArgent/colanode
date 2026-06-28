import { useLiveQuery } from '@colanode/ui/hooks/use-live-query';

interface InboxPanelProps {
  userId: string;
}

export const InboxPanel = ({ userId }: InboxPanelProps) => {
  const notificationsQuery = useLiveQuery({
    type: 'notification.list',
    userId,
  });

  const notifications = notificationsQuery.data ?? [];

  return (
    <div className="flex flex-col">
      {notifications.length === 0 && (
        <div className="p-4 text-sm text-muted-foreground">
          No notifications
        </div>
      )}
      {notifications.map((n) => (
        <button
          key={n.id}
          className="text-left p-2 hover:bg-muted"
          onClick={() => {
            window.colanode.executeMutation({
              type: 'notification.read',
              userId,
              notificationId: n.id,
            });
          }}
        >
          <span className={n.read_at ? 'opacity-60' : 'font-semibold'}>
            {n.type} · {n.source_node_id}
          </span>
        </button>
      ))}
    </div>
  );
};
