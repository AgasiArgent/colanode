# Native Mobile M4 — Inbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Native Inbox: a live notification list (who did what, where, when) with read/unread states, tap-through into the conversation, and an unread badge on the Inbox tab.

**Architecture:** Zero new client plumbing — `notification.list` and `notification.unread-count` live queries already implement `checkForChanges` (events `notification.created`/`notification.read`), and the `notification.read` mutation is the single read-state transition. The screen resolves the actor via the users collection and the target node via `collections.nodes`, then navigates to the existing Chats→Conversation screen with `nodeId = root_id`. Pure display helpers (label per type, relative time, conversation title) are TDD'd.

**Spec:** `docs/superpowers/specs/2026-07-10-native-mobile-app-design.md` (milestone M4)

## Global Constraints

- Prerequisites: M1–M3 landed (branch `worktree-design-briefs`). Gates: `npm run compile -w @colanode/mobile`, `npm run test -w @colanode/mobile` (TS6305 → `npx turbo run build --filter=@colanode/ui` once, never commit output).
- Theme tokens only; Mycel copy rules; loud errors via `Alert.alert`; no `@tiptap/*` value imports (type-only).
- Data facts (verified): query `notification.list` `{ type, userId }` → `SelectNotification[]` ordered `created_at desc`, NO pagination (fine — inbox volumes are small; note as `shortcut:` if rendering >200). `SelectNotification` fields are **snake_case**: `id, user_id, workspace_id, root_id, type, source_node_id, actor_id: string|null, preview: string ("{}" today), created_at, read_at: string|null, revision`. Query `notification.unread-count` `{ type, userId }` → `number` (counts `read_at is null`). Mutation `notification.read` `{ type, userId, notificationId }` → `{ success }`. Types produced today: `mention`, `direct_message` (union also declares `task_assigned`, `task_status` — render labels for all four, forward-compatible). `preview` is EMPTY today — no message excerpt; do not fake one.
- Navigation: tap target is **`root_id`** (the conversation/channel root), not `source_node_id`. Cross-tab navigation: Inbox tab → Chats tab's nested `Conversation` screen.

---

### Task 1: Pure display helpers (TDD)

**Files:**
- Create: `apps/mobile/src/inbox/notification-display.ts`
- Test: `apps/mobile/src/inbox/notification-display.test.ts`

**Interfaces:**
- Produces: `notificationLabel(type: string): string`; `formatRelativeTime(iso: string, now: Date): string`; `conversationTitle(node: LocalNode | undefined, users: User[], ownUserId: string): string`.

- [ ] **Step 1: Failing tests**

Create `apps/mobile/src/inbox/notification-display.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import type { LocalNode } from '@colanode/client/types';
import type { User } from '@colanode/client/types';
import {
  conversationTitle,
  formatRelativeTime,
  notificationLabel,
} from './notification-display';

describe('notificationLabel', () => {
  it('labels known types', () => {
    expect(notificationLabel('mention')).toBe('mentioned you');
    expect(notificationLabel('direct_message')).toBe('sent you a message');
    expect(notificationLabel('task_assigned')).toBe('assigned you a task');
    expect(notificationLabel('task_status')).toBe('updated a task');
  });

  it('falls back for unknown types', () => {
    expect(notificationLabel('something_new')).toBe('sent a notification');
  });
});

describe('formatRelativeTime', () => {
  const now = new Date('2026-07-12T12:00:00Z');

  it('minutes, hours, days', () => {
    expect(formatRelativeTime('2026-07-12T11:59:30Z', now)).toBe('now');
    expect(formatRelativeTime('2026-07-12T11:45:00Z', now)).toBe('15m');
    expect(formatRelativeTime('2026-07-12T09:00:00Z', now)).toBe('3h');
    expect(formatRelativeTime('2026-07-10T09:00:00Z', now)).toBe('2d');
  });

  it('falls back to a date beyond 7 days', () => {
    expect(formatRelativeTime('2026-06-01T09:00:00Z', now)).toMatch(/jun 1/i);
  });
});

describe('conversationTitle', () => {
  const users = [
    { id: 'u-me', name: 'Me' },
    { id: 'u-ana', name: 'Ana' },
  ] as User[];

  it('chat: counterpart name', () => {
    const chat = {
      id: 'x1ch',
      type: 'chat',
      collaborators: { 'u-me': 'admin', 'u-ana': 'admin' },
    } as unknown as LocalNode;
    expect(conversationTitle(chat, users, 'u-me')).toBe('Ana');
  });

  it('channel: its name', () => {
    const channel = { id: 'x2cn', type: 'channel', name: 'Design' } as unknown as LocalNode;
    expect(conversationTitle(channel, users, 'u-me')).toBe('Design');
  });

  it('missing node: fallback', () => {
    expect(conversationTitle(undefined, users, 'u-me')).toBe('Conversation');
  });
});
```

- [ ] **Step 2: Run — FAIL** (`npm run test -w @colanode/mobile`).

- [ ] **Step 3: Implement**

Create `apps/mobile/src/inbox/notification-display.ts`:

```ts
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
```

(Type note for the executor: `LocalNode` is a union — narrow `chat` via `node.type === 'chat'` before touching `collaborators`; if the union member types make the direct property access fail, narrow with the exported `LocalChatNode`/`LocalChannelNode` types instead of casting through `any`.)

- [ ] **Step 4: Run — PASS. Commit**

```bash
git add apps/mobile/src/inbox
git commit -m "feat(mobile): inbox display helpers — labels, relative time, titles"
```

---

### Task 2: Inbox screen — list, read state, tap-through

**Files:**
- Rewrite: `apps/mobile/src/screens/inbox/inbox-screen.tsx`
- Modify: `apps/mobile/src/navigation/root-navigator.tsx` (typed nested navigation for the Chats tab)

**Interfaces:**
- Consumes: `useLiveQuery` (Colanode hook) with `notification.list`; react-db `useLiveQuery`+`eq` over `collections.users`/`collections.nodes`; `useMutation`; helpers (Task 1); `NodeAvatar`; `useCurrentWorkspace`.
- Produces: working Inbox tab. `RootTabParamList.Chats` becomes `NavigatorScreenParams<ChatsStackParamList>` so `navigation.navigate('Chats', { screen: 'Conversation', params })` typechecks.

- [ ] **Step 1: Type the nested navigator**

In `root-navigator.tsx`:

```ts
import { type NavigatorScreenParams } from '@react-navigation/native';
import { type ChatsStackParamList } from '@colanode/mobile/navigation/chats-navigator';

export type RootTabParamList = {
  Chats: NavigatorScreenParams<ChatsStackParamList> | undefined;
  Spaces: undefined;
  Inbox: undefined;
  Settings: undefined;
};
```

(Keep everything else as is; `Tab.Screen name="Chats"` needs no change — `undefined` keeps plain tab presses valid.)

- [ ] **Step 2: Rewrite the Inbox screen**

Replace `apps/mobile/src/screens/inbox/inbox-screen.tsx` (drops the M1 placeholder):

```tsx
import { eq, useLiveQuery as useDbLiveQuery } from '@tanstack/react-db';
import { useNavigation } from '@react-navigation/native';
import { type BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useMemo } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import type { SelectNotification } from '@colanode/client/databases/workspace';
import { NodeAvatar } from '@colanode/mobile/components/node-avatar';
import {
  conversationTitle,
  formatRelativeTime,
  notificationLabel,
} from '@colanode/mobile/inbox/notification-display';
import { type RootTabParamList } from '@colanode/mobile/navigation/root-navigator';
import { useCurrentWorkspace } from '@colanode/mobile/session/current-workspace-context';
import { type Palette } from '@colanode/mobile/theme/palette';
import { useTheme } from '@colanode/mobile/theme/theme-context';
import { radius, spacing } from '@colanode/mobile/theme/tokens';
import { fonts, typeScale } from '@colanode/mobile/theme/typography';
import { useLiveQuery } from '@colanode/ui/hooks/use-live-query';
import { useMutation } from '@colanode/ui/hooks/use-mutation';

const createStyles = (palette: Palette) =>
  StyleSheet.create({
    list: { flex: 1, backgroundColor: palette.background },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: palette.border,
    },
    text: { flex: 1, gap: 2 },
    line: { ...typeScale.body, color: palette.textSecondary },
    actor: { fontFamily: fonts.bodyBold, color: palette.textPrimary },
    target: { fontFamily: fonts.bodyMedium, color: palette.textPrimary },
    time: { fontFamily: fonts.mono, fontSize: 11, color: palette.textFaint },
    dot: {
      width: 9,
      height: 9,
      borderRadius: radius.full,
      backgroundColor: palette.spore,
    },
    empty: {
      ...typeScale.body,
      color: palette.textMuted,
      textAlign: 'center',
      padding: spacing.xl,
    },
  });

const NotificationRow = ({
  notification,
}: {
  notification: SelectNotification;
}) => {
  const { workspace, collections } = useCurrentWorkspace();
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const navigation =
    useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const { mutate } = useMutation();

  const actorQuery = useDbLiveQuery(
    (q) =>
      q
        .from({ users: collections.users })
        .where(({ users }) => eq(users.id, notification.actor_id ?? ''))
        .findOne(),
    [notification.actor_id]
  );
  const rootQuery = useDbLiveQuery(
    (q) =>
      q
        .from({ nodes: collections.nodes })
        .where(({ nodes }) => eq(nodes.id, notification.root_id))
        .findOne(),
    [notification.root_id]
  );
  const usersQuery = useDbLiveQuery(
    (q) => q.from({ users: collections.users }),
    []
  );

  const actor = actorQuery.data;
  const root = rootQuery.data;
  const unread = notification.read_at === null;
  const title = conversationTitle(
    root,
    usersQuery.data ?? [],
    workspace.userId
  );

  const open = () => {
    if (unread) {
      mutate({
        input: {
          type: 'notification.read',
          userId: workspace.userId,
          notificationId: notification.id,
        },
        onError: (error) => Alert.alert('Could not mark as read', error.message),
      });
    }
    if (root && (root.type === 'chat' || root.type === 'channel')) {
      navigation.navigate('Chats', {
        screen: 'Conversation',
        params: { nodeId: notification.root_id, title },
      });
    } else {
      Alert.alert(
        'Not available on mobile yet',
        'Open this on desktop or web to see it.'
      );
    }
  };

  return (
    <Pressable
      style={styles.row}
      accessibilityRole="button"
      testID={`notification-${notification.id}`}
      onPress={open}
    >
      <NodeAvatar
        id={notification.actor_id ?? notification.id}
        avatar={actor?.avatar}
        name={actor?.name}
        size={36}
      />
      <View style={styles.text}>
        <Text style={styles.line} numberOfLines={2}>
          <Text style={styles.actor}>{actor?.name ?? 'Someone'}</Text>
          {` ${notificationLabel(notification.type)} in `}
          <Text style={styles.target}>{title}</Text>
        </Text>
        <Text style={styles.time}>
          {formatRelativeTime(notification.created_at, new Date())}
        </Text>
      </View>
      {unread ? <View style={styles.dot} /> : null}
    </Pressable>
  );
};

export const InboxScreen = () => {
  const { workspace } = useCurrentWorkspace();
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const notificationList = useLiveQuery({
    type: 'notification.list',
    userId: workspace.userId,
  });

  return (
    <FlatList
      style={styles.list}
      testID="inbox-list"
      data={notificationList.data ?? []}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <NotificationRow notification={item} />}
      ListEmptyComponent={
        <Text style={styles.empty}>You're all caught up.</Text>
      }
    />
  );
};
```

Executor notes: verify the `SelectNotification` export path (`@colanode/client/databases/workspace` barrel — check `packages/client/src/databases/workspace/index.ts`; if not exported there, import the type from the module that is, or type rows as the `notification.list` QueryMap output which is the same). Read rows are dimmed by unread-dot absence + `textSecondary` line — no extra opacity to keep contrast AA.

- [ ] **Step 3: Gates + commit**

```bash
npm run test -w @colanode/mobile && npm run compile -w @colanode/mobile
git add apps/mobile/src
git commit -m "feat(mobile): inbox — live notification list with read state and tap-through"
```

---

### Task 3: Inbox tab badge

**Files:**
- Modify: `apps/mobile/src/navigation/root-navigator.tsx`

**Interfaces:**
- Consumes: `useLiveQuery` (Colanode hook) `notification.unread-count` + `useCurrentWorkspace` (RootNavigator renders inside the session provider — available).

- [ ] **Step 1: Badge**

In `RootNavigator`, alongside the existing radar badge code:

```tsx
const { workspace } = useCurrentWorkspace();
const unreadCountQuery = useLiveQuery({
  type: 'notification.unread-count',
  userId: workspace.userId,
});
const inboxBadge = unreadCountQuery.data ?? 0;
```

Inbox `Tab.Screen` gets `options={{ tabBarBadge: inboxBadge > 0 ? inboxBadge : undefined, tabBarBadgeStyle: /* same spore style as Chats */ }}` — extract the shared badge style object into a local const to avoid duplication with the Chats badge.

- [ ] **Step 2: Gates + commit**

```bash
npm run test -w @colanode/mobile && npm run compile -w @colanode/mobile
git add apps/mobile/src/navigation
git commit -m "feat(mobile): inbox tab unread badge"
```

---

### Task 4: Simulator verification (manual gate, no commit)

Mac workflow as M3 (login shell, nvm 24.15.0, UDID `50B1BC35-75C8-406E-977B-6E731AE92636`; `expo prebuild -p ios --clean` if exsqlite3 errors; kill orphaned Metro, restart with `--clear`; for the http test server delete `NSAllowsLocalNetworking` from the generated Info.plist). Test data: sign in as `mcp-agent@colanode.test` on `http://100.74.217.116:3001/config`; generate notifications by having ANOTHER identity mention/DM the agent — e.g. via a `@colanode/client-node` bootEngine script or the colanode MCP tooling on the Lenovo (the M3 sim run left a working injector recipe).

- [ ] **Step 1: Build, launch, sign in** (persisted session may already exist).
- [ ] **Step 2: Generate a mention** for mcp-agent from another user; the Inbox list shows "«Actor» mentioned you in «Channel»" with avatar, relative time, spore unread dot — arriving LIVE while the Inbox tab is open. Tab badge shows the count. Screenshot.
- [ ] **Step 3: Tap the row** → lands on the Conversation screen of the right channel; returning to Inbox shows the row without the dot (read), badge decremented. Screenshot both.
- [ ] **Step 4: DM notification** (`direct_message`) renders with the counterpart title. If a second sender identity is impossible, report as environmental.
- [ ] **Step 5: Report** + screenshots via SendUserFile.

---

## Self-Review Notes

- Spec coverage (M4): notification list ✓ (T2), read/unread ✓ (T2), tab badges ✓ (T3). "Invitations" from the spec DO NOT EXIST server-side (no such notification type is produced) — documented reality, not a gap; the label map covers all four declared types and unknown types degrade gracefully.
- `preview` is empty today → rows show actor + action + place, no excerpt; when the server starts filling `preview`, extend the row (noted, out of scope).
- `notification.list` has no pagination — `shortcut:` acceptable at inbox volumes; revisit if lists exceed a few hundred.
- Foreground toasts (web's InAppNotificationToaster) are web-routed and sonner-based — a native equivalent is future polish, not M4 scope (push notifications already cover backgrounded delivery on iOS).
