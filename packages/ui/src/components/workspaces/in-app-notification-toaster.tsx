import { useLocation, useNavigate } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

import { useWorkspace } from '@colanode/ui/contexts/workspace';
import { useLiveQuery } from '@colanode/ui/hooks/use-live-query';

// Only surface notifications that arrived while the app is open. The seen-set
// dedupes, and this freshness window guards against toasting historical
// notifications that stream in on first load.
const FRESH_WINDOW_MS = 60_000;

const NOTIFICATION_LABELS: Record<string, string> = {
  mention: 'mentioned you',
  direct_message: 'sent you a message',
  task_assigned: 'assigned you a task',
  task_status: 'updated a task',
};

// Shows a transient in-app toast when a new notification arrives while the user
// is in the app but NOT already viewing that conversation. Locked-screen /
// backgrounded delivery is handled by native APNs push; this covers the
// foreground case. Mounted once per active workspace, so it works on web,
// desktop and mobile (shared UI) without per-platform code.
export const InAppNotificationToaster = () => {
  const workspace = useWorkspace();
  const navigate = useNavigate();
  const location = useLocation();

  const notificationsQuery = useLiveQuery({
    type: 'notification.list',
    userId: workspace.userId,
  });
  const usersQuery = useLiveQuery({
    type: 'user.list',
    userId: workspace.userId,
  });

  const notifications = notificationsQuery.data ?? [];
  const users = usersQuery.data ?? [];

  // Read the current location from a ref so the effect doesn't re-run (and
  // re-evaluate suppression against a stale path) on every navigation.
  const locationRef = useRef(location);
  locationRef.current = location;

  const seenRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    // Seed on the first pass so notifications already present at mount never
    // toast — only genuinely new arrivals do.
    if (seenRef.current === null) {
      seenRef.current = new Set(notifications.map((n) => n.id));
      return;
    }

    const seen = seenRef.current;
    for (const notification of notifications) {
      if (seen.has(notification.id)) {
        continue;
      }
      seen.add(notification.id);

      if (notification.read_at) {
        continue;
      }
      if (notification.actor_id === workspace.userId) {
        continue;
      }

      const ageMs = Date.now() - new Date(notification.created_at).getTime();
      if (ageMs > FRESH_WINDOW_MS) {
        continue;
      }

      // Suppress while backgrounded or when the user is already looking at the
      // conversation this notification belongs to.
      if (typeof document !== 'undefined' && document.hidden) {
        continue;
      }
      if (locationRef.current.pathname.includes(notification.root_id)) {
        continue;
      }

      const author =
        users.find((user) => user.id === notification.actor_id)?.name ??
        'Someone';
      const label =
        NOTIFICATION_LABELS[notification.type] ?? 'sent a notification';
      const rootId = notification.root_id;

      const toastId: string | number = toast(
        <button
          type="button"
          className="flex w-full flex-col items-start text-left"
          onClick={() => {
            toast.dismiss(toastId);
            navigate({
              to: '/workspace/$userId/$nodeId',
              params: { userId: workspace.userId, nodeId: rootId },
            });
          }}
        >
          <span className="text-sm font-semibold">{author}</span>
          <span className="text-sm text-muted-foreground">{label}</span>
        </button>,
        { duration: 3000 }
      );
    }
  }, [notifications, users, navigate, workspace.userId]);

  return null;
};
