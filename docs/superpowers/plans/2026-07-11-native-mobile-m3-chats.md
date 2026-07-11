# Native Mobile M3 — Chats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Native chats: the Chats tab lists direct messages and channels with unread indicators; a conversation screen shows paginated messages as Mycel bubbles with a mini rich-text renderer; a composer sends plain-text messages; conversations are marked seen; long-press copies a message.

**Architecture:** Reuse the DOM-free TanStack DB layer from `packages/ui`: the singleton `collections` (preloaded at boot) + `collections.workspace(userId)` provide live node/user collections; screens query them with `useLiveQuery`/`useLiveInfiniteQuery` from `@tanstack/react-db` — exactly the web's data path, new code is only RN presentation. Message content arrives as a block map; the existing pure `mapBlocksToContents` converts it to a JSONContent tree which a small RN renderer draws (paragraph/text + marks; unknown blocks degrade to text). Unread state comes from a native RadarContext over the `radar.data.get` live query; `node.interaction.seen` marks reads. Message ids are ULIDs (time-sortable), so `orderBy id desc` + inverted FlatList = chronological chat with correct pagination.

**Tech Stack:** `@tanstack/react-db` (direct dep now), `expo-clipboard` (copy action), existing hooks/shim/theme.

**Spec:** `docs/superpowers/specs/2026-07-10-native-mobile-app-design.md` (milestone M3)

## Global Constraints

- Prerequisites: M1, M1.5, M2 landed (branch `worktree-design-briefs`).
- Monorepo installs from repo root with `-w @colanode/mobile`; gates: `npm run compile -w @colanode/mobile`, `npm run test -w @colanode/mobile`. If compile fails with TS6305, run `npx turbo run build --filter=@colanode/ui` once (generated, never committed).
- Theme tokens only; Mycel copy rules (sentence case, no emoji in chrome); loud errors via `Alert.alert`.
- From `packages/ui` import ONLY `hooks/*`, `collections/*`, `lib/*`, `window`, `contexts/*` types — never `components/*` (DOM) and never `editor/*` (TipTap).
- Key data facts (verified): chats/channels/messages are NODES. `LocalChatNode.collaborators: Record<userId, role>` (counterpart = the key ≠ own userId); `LocalChannelNode` has `name`, `parentId`; `LocalMessageNode` has `content?: Record<string, Block> | null`, `createdBy`, `createdAt`, `parentId`. `mapBlocksToContents(parentId, blocks)` from `@colanode/client/lib` converts blocks → `JSONContent[]` (pure). Send: mutation `message.create` `{ type, userId, parentId, content: JSONContent, referenceId? }` — content is a TipTap doc (`{type:'doc',content:[{type:'paragraph',content:[{type:'text',text}]}]}`); the handler converts to blocks. Unread: query `radar.data.get` (no fields) → `Record<userId, WorkspaceRadarData{ state, nodeStates: Record<nodeId,{hasUnread,unreadCount}> }>`; mutation `node.interaction.seen` `{ type, userId, nodeId }`. Users: `collections.workspace(userId).users` (User: `id,name,email,avatar,role`). Avatars: query `avatar.get` `{ type, accountId, avatarId }` → `{ url } | null`; on mobile `url` is a `file://` URI. Collections: `import { collections } from '@colanode/ui/collections'`; `await collections.preload()` once at boot; `collections.workspace(userId)` throws until the workspaces collection contains that user — gate on it with a react-db live query, mirroring `packages/ui/src/components/workspaces/workspace.tsx`.

---

### Task 1: Deps + collections bootstrap + workspace collections gate

**Files:**
- Modify: `apps/mobile/package.json` (+ lockfile)
- Modify: `apps/mobile/src/app.tsx` (preload collections during init)
- Create: `apps/mobile/src/session/workspace-collections-gate.tsx`
- Modify: `apps/mobile/src/session/current-workspace-context.tsx` (add `collections`)
- Modify: `apps/mobile/src/session/session-gate.tsx` (wrap RootNavigator in the new gate)

**Interfaces:**
- Consumes: `collections` singleton from `@colanode/ui/collections`; `WorkspaceCollections` type from `@colanode/ui/collections/workspace` (verify the actual module path exporting the class/type before writing — the barrel `@colanode/ui/collections` re-exports it on web).
- Produces: `useCurrentWorkspace()` now also returns `collections: WorkspaceCollections`; `WorkspaceCollectionsGate({ userId, children })` renders children only when `collections.workspace(userId)` is safe to call.

- [ ] **Step 1: Install deps**

```bash
npm install @tanstack/react-db expo-clipboard -w @colanode/mobile
```

(Match `@tanstack/react-db`'s version range to `packages/ui/package.json` — `^0.1.79` — so npm dedupes to one copy; verify with `npm ls @tanstack/react-db`.)

- [ ] **Step 2: Preload collections at boot**

In `apps/mobile/src/app.tsx` `initialize()`, after `installColanodeShim(...)` and before `setBoot({ phase:'ready', ... })`:

```ts
await collections.preload();
```

with `import { collections } from '@colanode/ui/collections';`. (Order matters: the collections constructor reads `window.colanode`/`window.eventBus` — the shim must be installed first.)

- [ ] **Step 3: Collections gate**

Create `apps/mobile/src/session/workspace-collections-gate.tsx`:

```tsx
import { eq, useLiveQuery } from '@tanstack/react-db';
import { type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useTheme } from '@colanode/mobile/theme/theme-context';
import { collections } from '@colanode/ui/collections';

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

// collections.workspace(userId) throws until the workspaces collection has
// synced the row for this user (same guard the web Workspace component
// implements via its own live query). Render children only once it is safe.
export const WorkspaceCollectionsGate = ({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) => {
  const { palette } = useTheme();
  const workspaceRow = useLiveQuery(
    (q) =>
      q
        .from({ workspaces: collections.workspaces })
        .where(({ workspaces }) => eq(workspaces.userId, userId))
        .findOne(),
    [userId]
  );

  if (!workspaceRow.data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.accent} />
      </View>
    );
  }

  return <>{children}</>;
};
```

(If `collections.workspaces` items are keyed differently — check `packages/ui/src/collections/workspaces.ts` for the field name (`userId`) — adjust the `eq`.)

- [ ] **Step 4: Extend the session context**

`current-workspace-context.tsx`: add `collections: WorkspaceCollections` to `CurrentWorkspace` (type import from the collections module). In `session-gate.tsx`, wrap the main branch:

```tsx
return (
  <WorkspaceCollectionsGate userId={session.workspace.userId}>
    <CurrentWorkspaceContext.Provider
      value={{ ...session, collections: collections.workspace(session.workspace.userId) }}
    >
      <RootNavigator />
    </CurrentWorkspaceContext.Provider>
  </WorkspaceCollectionsGate>
);
```

Restructure so `collections.workspace(...)` is called INSIDE the gate (a small inner component `<SessionProvider session={session}>` that composes the value) — it must never run before the gate passes.

- [ ] **Step 5: Gates + commit**

```bash
npm run test -w @colanode/mobile && npm run compile -w @colanode/mobile
git add apps/mobile package-lock.json
git commit -m "feat(mobile): TanStack DB collections bootstrap + workspace collections gate"
```

---

### Task 2: Radar context (unread + mark seen)

**Files:**
- Create: `apps/mobile/src/session/radar-context.tsx`
- Modify: `apps/mobile/src/session/session-gate.tsx` (mount provider inside the collections gate)

**Interfaces:**
- Consumes: `useLiveQuery` hook (Colanode's, from `@colanode/ui/hooks/use-live-query`) with `{ type: 'radar.data.get' }`; `getIdType`/`IdType` from `@colanode/core`.
- Produces: `useRadar(): { getNodeState(nodeId): UnreadState; getChatsState(): UnreadState; getChannelsState(): UnreadState; markNodeAsSeen(nodeId): void }` — bound to the current userId (unlike the web context, which threads userId per call).

- [ ] **Step 1: Implement**

Create `apps/mobile/src/session/radar-context.tsx`:

```tsx
import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { getIdType, IdType } from '@colanode/core';
import { useLiveQuery } from '@colanode/ui/hooks/use-live-query';

export interface UnreadState {
  hasUnread: boolean;
  unreadCount: number;
}

const EMPTY: UnreadState = { hasUnread: false, unreadCount: 0 };

interface Radar {
  getNodeState: (nodeId: string) => UnreadState;
  getChatsState: () => UnreadState;
  getChannelsState: () => UnreadState;
  markNodeAsSeen: (nodeId: string) => void;
}

const RadarContext = createContext<Radar | null>(null);

export const useRadar = (): Radar => {
  const context = useContext(RadarContext);
  if (!context) {
    throw new Error('useRadar used outside RadarProvider');
  }
  return context;
};

const sum = (states: UnreadState[]): UnreadState => ({
  hasUnread: states.some((s) => s.hasUnread),
  unreadCount: states.reduce((acc, s) => acc + s.unreadCount, 0),
});

export const RadarProvider = ({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) => {
  const radarQuery = useLiveQuery({ type: 'radar.data.get' });

  const value = useMemo((): Radar => {
    const nodeStates = radarQuery.data?.[userId]?.nodeStates ?? {};
    const byIdType = (idType: IdType) =>
      sum(
        Object.entries(nodeStates)
          .filter(([nodeId]) => getIdType(nodeId) === idType)
          .map(([, state]) => state)
      );

    return {
      getNodeState: (nodeId) => nodeStates[nodeId] ?? EMPTY,
      getChatsState: () => byIdType(IdType.Chat),
      getChannelsState: () => byIdType(IdType.Channel),
      markNodeAsSeen: (nodeId) => {
        window.colanode
          .executeMutation({ type: 'node.interaction.seen', userId, nodeId })
          .catch((error) =>
            console.warn('[Mobile] mark-seen failed', nodeId, error)
          );
      },
    };
  }, [radarQuery.data, userId]);

  return <RadarContext.Provider value={value}>{children}</RadarContext.Provider>;
};
```

Mount in `session-gate.tsx` inside the collections gate, wrapping the workspace provider's children: `<RadarProvider userId={session.workspace.userId}> <RootNavigator/> </RadarProvider>`.

- [ ] **Step 2: Gates + commit**

```bash
npm run test -w @colanode/mobile && npm run compile -w @colanode/mobile
git add apps/mobile/src
git commit -m "feat(mobile): radar context — unread state and mark-as-seen"
```

---

### Task 3: Avatar component + message content renderer (TDD for mark mapping)

**Files:**
- Create: `apps/mobile/src/components/node-avatar.tsx`
- Create: `apps/mobile/src/messages/mark-style.ts`
- Test: `apps/mobile/src/messages/mark-style.test.ts`
- Create: `apps/mobile/src/messages/message-content.tsx`

**Interfaces:**
- Consumes: `avatar.get` query; `mapBlocksToContents` from `@colanode/client/lib`; `JSONContent` type from `@tiptap/core` — **type-only import** (the metro stub empties @tiptap at runtime; a value import would crash — import type only!); theme.
- Produces: `NodeAvatar({ id, avatar, name, size })`; `markStyle(marks, palette): { style: TextStyle; href?: string }`; `MessageContent({ message: LocalMessageNode })`.

- [ ] **Step 1: NodeAvatar**

Create `apps/mobile/src/components/node-avatar.tsx`:

```tsx
import { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { getIdType, IdType } from '@colanode/core';
import { useCurrentWorkspace } from '@colanode/mobile/session/current-workspace-context';
import { type Palette } from '@colanode/mobile/theme/palette';
import { useTheme } from '@colanode/mobile/theme/theme-context';
import { radius } from '@colanode/mobile/theme/tokens';
import { fonts } from '@colanode/mobile/theme/typography';
import { useQuery } from '@colanode/ui/hooks/use-query';

interface NodeAvatarProps {
  id: string;
  avatar?: string | null;
  name?: string | null;
  size?: number;
}

const createStyles = (palette: Palette, size: number) =>
  StyleSheet.create({
    circle: {
      width: size,
      height: size,
      borderRadius: radius.full,
      backgroundColor: palette.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    initial: {
      fontFamily: fonts.bodyBold,
      fontSize: size * 0.42,
      color: palette.accentSoftForeground,
    },
    image: { width: size, height: size },
  });

const AvatarImage = ({ avatarId, size }: { avatarId: string; size: number }) => {
  const { account } = useCurrentWorkspace();
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette, size), [palette, size]);
  const avatarQuery = useQuery({
    type: 'avatar.get',
    accountId: account.id,
    avatarId,
  });

  if (!avatarQuery.data?.url) {
    return null;
  }
  return <Image source={{ uri: avatarQuery.data.url }} style={styles.image} />;
};

export const NodeAvatar = ({ id, avatar, name, size = 36 }: NodeAvatarProps) => {
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette, size), [palette, size]);
  const isImageAvatar = !!avatar && getIdType(avatar) === IdType.Avatar;
  const initial = (name ?? '?').trim().charAt(0).toUpperCase() || '?';

  return (
    <View style={styles.circle} testID={`avatar-${id}`}>
      {isImageAvatar ? (
        <AvatarImage avatarId={avatar} size={size} />
      ) : (
        <Text style={styles.initial}>{initial}</Text>
      )}
    </View>
  );
};
```

(Emoji/icon avatar ids — `IdType.EmojiSkin`/`IdType.Icon` — fall back to initials in M3; noted, not a bug.)

- [ ] **Step 2: mark-style TDD**

Create `apps/mobile/src/messages/mark-style.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { lightPalette } from '@colanode/mobile/theme/palette';
import { markStyle } from './mark-style';

describe('markStyle', () => {
  it('maps bold+italic to family/style', () => {
    const { style } = markStyle(
      [{ type: 'bold' }, { type: 'italic' }],
      lightPalette
    );
    expect(style.fontFamily).toContain('Karla_700');
    expect(style.fontStyle).toBe('italic');
  });

  it('maps code to mono with surface background', () => {
    const { style } = markStyle([{ type: 'code' }], lightPalette);
    expect(style.fontFamily).toContain('SplineSansMono');
    expect(style.backgroundColor).toBe(lightPalette.surface);
  });

  it('extracts link href and accent color', () => {
    const { style, href } = markStyle(
      [{ type: 'link', attrs: { href: 'https://x.dev' } }],
      lightPalette
    );
    expect(href).toBe('https://x.dev');
    expect(style.color).toBe(lightPalette.accent);
  });

  it('combines strike and underline into one decoration', () => {
    const { style } = markStyle(
      [{ type: 'strike' }, { type: 'underline' }],
      lightPalette
    );
    expect(style.textDecorationLine).toBe('underline line-through');
  });

  it('returns empty style for no marks', () => {
    expect(markStyle(undefined, lightPalette)).toEqual({ style: {} });
  });
});
```

Run `npm run test -w @colanode/mobile` → FAIL (module missing). Then create `apps/mobile/src/messages/mark-style.ts`:

```ts
import type { TextStyle } from 'react-native';

import { type Palette } from '@colanode/mobile/theme/palette';
import { fonts } from '@colanode/mobile/theme/typography';

interface Mark {
  type: string;
  attrs?: Record<string, unknown> | null;
}

// Maps ProseMirror marks on a text leaf to RN Text styling. Pure — unit-tested.
export const markStyle = (
  marks: Mark[] | null | undefined,
  palette: Palette
): { style: TextStyle; href?: string } => {
  const style: TextStyle = {};
  let href: string | undefined;
  let underline = false;
  let strike = false;

  for (const mark of marks ?? []) {
    switch (mark.type) {
      case 'bold':
        style.fontFamily = style.fontStyle === 'italic' ? fonts.bodyBold : fonts.bodyBold;
        break;
      case 'italic':
        style.fontStyle = 'italic';
        break;
      case 'underline':
        underline = true;
        break;
      case 'strike':
        strike = true;
        break;
      case 'code':
        style.fontFamily = fonts.mono;
        style.backgroundColor = palette.surface;
        break;
      case 'link':
        href = typeof mark.attrs?.href === 'string' ? mark.attrs.href : undefined;
        style.color = palette.accent;
        underline = true;
        break;
      default:
        break;
    }
  }

  if (underline && strike) {
    style.textDecorationLine = 'underline line-through';
  } else if (underline) {
    style.textDecorationLine = 'underline';
  } else if (strike) {
    style.textDecorationLine = 'line-through';
  }

  return href ? { style, href } : { style };
};
```

Run tests → PASS.

- [ ] **Step 3: MessageContent renderer**

Create `apps/mobile/src/messages/message-content.tsx`:

```tsx
import { useMemo } from 'react';
import { Alert, Linking, StyleSheet, Text } from 'react-native';

import type { JSONContent } from '@tiptap/core';
import { mapBlocksToContents } from '@colanode/client/lib';
import type { LocalMessageNode } from '@colanode/client/types';
import { markStyle } from '@colanode/mobile/messages/mark-style';
import { type Palette } from '@colanode/mobile/theme/palette';
import { useTheme } from '@colanode/mobile/theme/theme-context';
import { spacing } from '@colanode/mobile/theme/tokens';
import { typeScale } from '@colanode/mobile/theme/typography';

const createStyles = (palette: Palette) =>
  StyleSheet.create({
    paragraph: { ...typeScale.body, color: palette.textPrimary },
    spacer: { height: spacing.xs },
    fallback: {
      ...typeScale.caption,
      color: palette.textMuted,
      fontStyle: 'italic',
    },
  });

const openLink = (href: string) => {
  Linking.openURL(href).catch(() =>
    Alert.alert('Could not open link', href)
  );
};

// Extracts the plain text of arbitrary unknown nodes so nothing ever renders
// as a hole — unsupported blocks degrade to their text content.
const textOf = (node: JSONContent): string => {
  if (node.type === 'text') return node.text ?? '';
  if (node.type === 'hardBreak') return '\n';
  return (node.content ?? []).map(textOf).join('');
};

const InlineNodes = ({
  nodes,
  palette,
}: {
  nodes: JSONContent[];
  palette: Palette;
}) => (
  <>
    {nodes.map((node, index) => {
      if (node.type === 'text') {
        const { style, href } = markStyle(node.marks, palette);
        return (
          <Text
            key={index}
            style={style}
            onPress={href ? () => openLink(href) : undefined}
          >
            {node.text ?? ''}
          </Text>
        );
      }
      if (node.type === 'hardBreak') {
        return <Text key={index}>{'\n'}</Text>;
      }
      if (node.type === 'mention') {
        const label =
          typeof node.attrs?.name === 'string' ? node.attrs.name : 'mention';
        return (
          <Text key={index} style={{ color: palette.accent }}>
            @{label}
          </Text>
        );
      }
      return <Text key={index}>{textOf(node)}</Text>;
    })}
  </>
);

export const MessageContent = ({ message }: { message: LocalMessageNode }) => {
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);

  const contents = useMemo(
    () => mapBlocksToContents(message.id, Object.values(message.content ?? {})),
    [message.id, message.content]
  );

  if (contents.length === 0) {
    return <Text style={styles.fallback}>empty message</Text>;
  }

  return (
    <>
      {contents.map((block, index) => {
        const inline = block.content ?? [];
        return (
          <Text key={block.attrs?.id ?? index} style={styles.paragraph}>
            <InlineNodes nodes={inline} palette={palette} />
          </Text>
        );
      })}
    </>
  );
};
```

(Every top-level block renders as a paragraph `Text`; nested structures flatten through `textOf`. This satisfies the spec's "unknown blocks render a labeled placeholder — never crash" with the stronger guarantee of showing their text.)

- [ ] **Step 4: Gates + commit**

```bash
npm run test -w @colanode/mobile && npm run compile -w @colanode/mobile
git add apps/mobile/src
git commit -m "feat(mobile): avatar component + message content renderer with mark mapping"
```

---

### Task 4: Chats tab — DM + channel lists with unread

**Files:**
- Create: `apps/mobile/src/navigation/chats-navigator.tsx`
- Rewrite: `apps/mobile/src/screens/chats/chats-screen.tsx`
- Create: `apps/mobile/src/screens/chats/chat-list-item.tsx`
- Modify: `apps/mobile/src/navigation/root-navigator.tsx` (Chats tab → stack, tab badge)

**Interfaces:**
- Consumes: `useCurrentWorkspace().collections` (Task 1), `useRadar` (Task 2), `NodeAvatar` (Task 3), react-db `useLiveQuery`/`eq`.
- Produces: `ChatsStackParamList = { ChatsHome: undefined; Conversation: { nodeId: string; title: string } }`; `ConversationScreen` referenced here is created in Task 5 — **Tasks 4+5 are one compile-clean series, single commit at Task 5's end.**

- [ ] **Step 1: Chats stack** — `chats-navigator.tsx`, same pattern as `settings-navigator.tsx`: screens `ChatsHome` (title "Chats") and `Conversation` (`options={({route}) => ({ title: route.params.title })}`).

- [ ] **Step 2: Chat list item**

Create `apps/mobile/src/screens/chats/chat-list-item.tsx`:

```tsx
import { eq, useLiveQuery } from '@tanstack/react-db';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { LocalChatNode } from '@colanode/client/types';
import { NodeAvatar } from '@colanode/mobile/components/node-avatar';
import { useCurrentWorkspace } from '@colanode/mobile/session/current-workspace-context';
import { useRadar } from '@colanode/mobile/session/radar-context';
import { type Palette } from '@colanode/mobile/theme/palette';
import { useTheme } from '@colanode/mobile/theme/theme-context';
import { radius, spacing } from '@colanode/mobile/theme/tokens';
import { fonts, typeScale } from '@colanode/mobile/theme/typography';

const createStyles = (palette: Palette) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
    },
    text: { flex: 1 },
    name: { ...typeScale.body, fontFamily: fonts.bodyBold, color: palette.textPrimary },
    nameUnread: { color: palette.textPrimary },
    badge: {
      minWidth: 20,
      height: 20,
      borderRadius: radius.full,
      backgroundColor: palette.spore,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 5,
    },
    badgeText: {
      fontFamily: fonts.monoMedium,
      fontSize: 11,
      color: palette.background,
    },
    dot: {
      width: 9,
      height: 9,
      borderRadius: radius.full,
      backgroundColor: palette.spore,
    },
  });

interface ChatListItemProps {
  chat: LocalChatNode;
  onPress: (nodeId: string, title: string) => void;
}

export const ChatListItem = ({ chat, onPress }: ChatListItemProps) => {
  const { workspace, collections } = useCurrentWorkspace();
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const radar = useRadar();

  const counterpartId =
    Object.keys(chat.collaborators).find((id) => id !== workspace.userId) ?? '';
  const userQuery = useLiveQuery(
    (q) =>
      q
        .from({ users: collections.users })
        .where(({ users }) => eq(users.id, counterpartId))
        .findOne(),
    [counterpartId]
  );

  const user = userQuery.data;
  const name = user?.name ?? 'Unnamed';
  const unread = radar.getNodeState(chat.id);

  return (
    <Pressable
      style={styles.row}
      testID={`chat-${chat.id}`}
      accessibilityRole="button"
      onPress={() => onPress(chat.id, name)}
    >
      <NodeAvatar id={counterpartId} avatar={user?.avatar} name={name} size={40} />
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
      </View>
      {unread.unreadCount > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unread.unreadCount}</Text>
        </View>
      ) : unread.hasUnread ? (
        <View style={styles.dot} />
      ) : null}
    </Pressable>
  );
};
```

- [ ] **Step 3: Chats screen** — rewrite `chats-screen.tsx`: a `SectionList` with two sections styled like the Settings headers (mono uppercase labels): "Direct messages" (react-db `useLiveQuery` over `collections.nodes` where `type=='chat'`, orderBy id asc → `ChatListItem`) and "Channels" (`type=='channel'`, row = `NodeAvatar(id, avatar, name)` + `#` mono glyph before the channel name + same unread badge via `radar.getNodeState(channel.id)`). Row press → `navigation.navigate('Conversation', { nodeId, title })`. Empty state: "No conversations yet. Say hello." Props typing: `NativeStackScreenProps<ChatsStackParamList, 'ChatsHome'>`.

- [ ] **Step 4: Root navigator** — Chats tab renders `ChatsNavigator` with `headerShown: false`; add a tab badge:

```tsx
// inside RootNavigator (already themed):
const radar = useRadar();
const chatsUnread = radar.getChatsState();
const channelsUnread = radar.getChannelsState();
const chatsBadge = chatsUnread.unreadCount + channelsUnread.unreadCount;
// Chats Tab.Screen options:
options={{ headerShown: false, tabBarBadge: chatsBadge > 0 ? chatsBadge : undefined,
  tabBarBadgeStyle: { backgroundColor: palette.spore, color: palette.background, fontFamily: fonts.monoMedium, fontSize: 11 } }}
```

(RootNavigator is rendered inside RadarProvider per Task 2 — the hook is available.)

- [ ] **Step 5: Proceed to Task 5** (compile red until ConversationScreen exists).

---

### Task 5: Conversation screen — messages, composer, mark seen, long-press copy

**Files:**
- Create: `apps/mobile/src/screens/chats/conversation-screen.tsx`
- Create: `apps/mobile/src/screens/chats/message-composer.tsx`

**Interfaces:**
- Consumes: everything above; `useLiveInfiniteQuery` from `@tanstack/react-db`; `expo-clipboard`; `compareString` NOT needed (inverted list consumes id-desc pages directly).
- Produces: `ConversationScreen` for `ChatsStackParamList['Conversation']`.

- [ ] **Step 1: Composer**

Create `apps/mobile/src/screens/chats/message-composer.tsx`:

```tsx
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { useCurrentWorkspace } from '@colanode/mobile/session/current-workspace-context';
import { type Palette } from '@colanode/mobile/theme/palette';
import { useTheme } from '@colanode/mobile/theme/theme-context';
import { radius, spacing } from '@colanode/mobile/theme/tokens';
import { fonts } from '@colanode/mobile/theme/typography';
import { useMutation } from '@colanode/ui/hooks/use-mutation';

const createStyles = (palette: Palette) =>
  StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
      padding: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: palette.border,
      backgroundColor: palette.surface,
    },
    input: {
      flex: 1,
      maxHeight: 120,
      minHeight: 40,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.lg,
      backgroundColor: palette.background,
      borderWidth: 1,
      borderColor: palette.border,
      color: palette.textPrimary,
      fontFamily: fonts.body,
      fontSize: 15,
    },
    send: {
      width: 40,
      height: 40,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

export const MessageComposer = ({ conversationId }: { conversationId: string }) => {
  const { workspace } = useCurrentWorkspace();
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const { isPending, mutate } = useMutation();
  const [text, setText] = useState('');

  const canSend = text.trim().length > 0 && !isPending;

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    // Plain-text M3 composer: one paragraph per line. The mutation handler
    // converts this TipTap doc into the block map (mapContentsToBlocks).
    const content = {
      type: 'doc',
      content: trimmed.split('\n').map((line) => ({
        type: 'paragraph',
        content: line.length > 0 ? [{ type: 'text', text: line }] : [],
      })),
    };
    setText('');
    mutate({
      input: {
        type: 'message.create',
        userId: workspace.userId,
        parentId: conversationId,
        content,
      },
      onError: (error) => {
        setText(trimmed);
        Alert.alert('Message not sent', error.message);
      },
    });
  };

  return (
    <View style={styles.bar}>
      <TextInput
        style={styles.input}
        multiline
        placeholder="Message"
        placeholderTextColor={palette.textFaint}
        value={text}
        onChangeText={setText}
        testID="message-input"
      />
      <Pressable
        style={[
          styles.send,
          { backgroundColor: canSend ? palette.accent : palette.surface },
        ]}
        disabled={!canSend}
        accessibilityRole="button"
        accessibilityLabel="Send"
        onPress={send}
        testID="message-send"
      >
        <Ionicons
          name="arrow-up"
          size={20}
          color={canSend ? palette.accentForeground : palette.textFaint}
        />
      </Pressable>
    </View>
  );
};
```

- [ ] **Step 2: Conversation screen**

Create `apps/mobile/src/screens/chats/conversation-screen.tsx`:

```tsx
import * as Clipboard from 'expo-clipboard';
import { eq, useLiveInfiniteQuery, useLiveQuery } from '@tanstack/react-db';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo } from 'react';
import {
  ActionSheetIOS,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { JSONContent } from '@tiptap/core';
import { mapBlocksToContents } from '@colanode/client/lib';
import type { LocalMessageNode } from '@colanode/client/types';
import { NodeAvatar } from '@colanode/mobile/components/node-avatar';
import { MessageContent } from '@colanode/mobile/messages/message-content';
import { MessageComposer } from '@colanode/mobile/screens/chats/message-composer';
import { type ChatsStackParamList } from '@colanode/mobile/navigation/chats-navigator';
import { useCurrentWorkspace } from '@colanode/mobile/session/current-workspace-context';
import { useRadar } from '@colanode/mobile/session/radar-context';
import { type Palette } from '@colanode/mobile/theme/palette';
import { useTheme } from '@colanode/mobile/theme/theme-context';
import { radius, spacing } from '@colanode/mobile/theme/tokens';
import { fonts, typeScale } from '@colanode/mobile/theme/typography';

const MESSAGES_PER_PAGE = 50;

const createStyles = (palette: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: palette.background },
    listContent: { padding: spacing.md, gap: spacing.sm },
    row: { flexDirection: 'row', gap: spacing.sm, maxWidth: '85%' },
    rowOwn: { alignSelf: 'flex-end' },
    rowOther: { alignSelf: 'flex-start' },
    bubble: { padding: spacing.sm + 2, gap: 2 },
    bubbleOwn: {
      backgroundColor: palette.bubbleOwn,
      borderRadius: radius.bubble,
      borderBottomRightRadius: radius.bubbleAnchor,
    },
    bubbleOther: {
      backgroundColor: palette.bubbleOther,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.bubbleOtherBorder,
      borderRadius: radius.bubble,
      borderBottomLeftRadius: radius.bubbleAnchor,
    },
    sender: {
      ...typeScale.caption,
      fontFamily: fonts.bodyBold,
      color: palette.accent,
    },
    time: {
      fontFamily: fonts.mono,
      fontSize: 10,
      color: palette.textFaint,
      alignSelf: 'flex-end',
    },
    empty: {
      ...typeScale.body,
      color: palette.textMuted,
      textAlign: 'center',
      padding: spacing.xl,
      transform: [{ scaleY: -1 }],
    },
  });

const messageText = (message: LocalMessageNode): string => {
  const contents = mapBlocksToContents(
    message.id,
    Object.values(message.content ?? {})
  );
  const walk = (node: JSONContent): string =>
    node.type === 'text'
      ? (node.text ?? '')
      : (node.content ?? []).map(walk).join('');
  return contents.map(walk).join('\n');
};

const MessageRow = ({ message }: { message: LocalMessageNode }) => {
  const { workspace, collections } = useCurrentWorkspace();
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const own = message.createdBy === workspace.userId;

  const senderQuery = useLiveQuery(
    (q) =>
      q
        .from({ users: collections.users })
        .where(({ users }) => eq(users.id, message.createdBy))
        .findOne(),
    [message.createdBy]
  );
  const sender = senderQuery.data;

  const time = new Date(message.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const longPress = () => {
    const copy = () => Clipboard.setStringAsync(messageText(message));
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Copy', 'Cancel'], cancelButtonIndex: 1 },
        (index) => {
          if (index === 0) copy();
        }
      );
    } else {
      copy();
    }
  };

  return (
    <View
      style={[
        styles.row,
        own ? styles.rowOwn : styles.rowOther,
        { transform: [{ scaleY: -1 }] },
      ]}
    >
      {!own ? (
        <NodeAvatar
          id={message.createdBy}
          avatar={sender?.avatar}
          name={sender?.name}
          size={28}
        />
      ) : null}
      <View
        style={[styles.bubble, own ? styles.bubbleOwn : styles.bubbleOther]}
        onStartShouldSetResponder={() => false}
      >
        <View onStartShouldSetResponder={() => false}>
          {!own ? (
            <Text style={styles.sender}>{sender?.name ?? 'Unnamed'}</Text>
          ) : null}
          <MessageContent message={message} />
          <Text style={styles.time}>{time}</Text>
        </View>
      </View>
    </View>
  );
};

type Props = NativeStackScreenProps<ChatsStackParamList, 'Conversation'>;

export const ConversationScreen = ({ route }: Props) => {
  const { nodeId } = route.params;
  const { workspace, collections } = useCurrentWorkspace();
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const radar = useRadar();

  const messagesQuery = useLiveInfiniteQuery(
    (q) =>
      q
        .from({ nodes: collections.nodes })
        .where(({ nodes }) => eq(nodes.type, 'message'))
        .where(({ nodes }) => eq(nodes.parentId, nodeId))
        .orderBy(({ nodes }) => nodes.id, 'desc'),
    {
      pageSize: MESSAGES_PER_PAGE,
      getNextPageParam: (lastPage: unknown[], allPages: unknown[][]) =>
        lastPage.length === MESSAGES_PER_PAGE ? allPages.length : undefined,
    },
    [workspace.userId, nodeId]
  );

  const messages = messagesQuery.data.map((node) => node as LocalMessageNode);

  // Newest message id: mark the conversation seen whenever it changes.
  const newestId = messages[0]?.id;
  useEffect(() => {
    radar.markNodeAsSeen(nodeId);
  }, [nodeId, newestId, radar]);

  const renderItem = useCallback(
    ({ item }: { item: LocalMessageNode }) => <MessageRow message={item} />,
    []
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 96 : 0}
    >
      <FlatList
        style={{ transform: [{ scaleY: -1 }] }}
        contentContainerStyle={styles.listContent}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (messagesQuery.hasNextPage && !messagesQuery.isFetchingNextPage) {
            messagesQuery.fetchNextPage();
          }
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>No messages yet. Say hello.</Text>
        }
        testID="message-list"
      />
      <MessageComposer conversationId={nodeId} />
    </KeyboardAvoidingView>
  );
};
```

Implementation notes for the executor:
- The inverted-list trick uses `transform: scaleY(-1)` on the list and each row (RN's `inverted` prop does exactly this internally — use the `inverted` prop if it plays well with `contentContainerStyle` gap; either is acceptable, keep ONE approach consistently).
- Long-press: attach `onLongPress={longPress}` — wrap the bubble `View` content in a `Pressable` (adjust the snippet: replace the inner `View` responder hack with `<Pressable onLongPress={longPress}>`); the snippet's responder lines are placeholders for that adjustment, remove them.
- Verify `useLiveInfiniteQuery`'s exact result API against `@tanstack/react-db` types (`.data`, `.hasNextPage`, `.isFetchingNextPage`, `.fetchNextPage()` — confirmed used by web `message-list.tsx`); adjust generics as the types demand rather than casting.

- [ ] **Step 3: Gates + commit (Tasks 4+5)**

```bash
npm run test -w @colanode/mobile && npm run compile -w @colanode/mobile
cd apps/mobile && npx expo export --platform ios --output-dir /tmp/expo-export-m3 && cd ../..
git add apps/mobile/src
git commit -m "feat(mobile): chats — DM/channel lists, conversation screen, composer, unread"
```

---

### Task 6: Simulator verification (manual gate, no commit)

**Files:** none.

Mac workflow as before (login shell, nvm 24.15.0, UDID `50B1BC35-75C8-406E-977B-6E731AE92636`). After fresh `npm ci`: if the native build fails on `exsqlite3_*` errors, run `npx expo prebuild -p ios --clean` first. **A logged-in session is REQUIRED for most checks** — if the sim has no persisted account and no test credentials are available, log what was verifiable (auth still works, tabs render) and report the rest as environmental.

- [ ] **Step 1: Build, launch.** If logged out and credentials exist, sign in via the M2 flow.
- [ ] **Step 2: Chats tab.** Sections "Direct messages" / "Channels" render with real nodes from the synced workspace; unread badges (spore amber) visible where radar reports unread; tab badge shows the sum. Screenshot.
- [ ] **Step 3: Conversation.** Open a channel or DM: messages render as Mycel bubbles (own = green-tinted right-anchored, other = surface left-anchored with avatar+name), timestamps in mono; scroll up loads older pages (50/page) without jumps. Screenshot.
- [ ] **Step 4: Send.** Type a multiline message, send: appears instantly (optimistic local-first), composer clears; verify on another client (web on desktop) that it syncs, or at minimum that it persists across app relaunch. Screenshot.
- [ ] **Step 5: Mark seen.** Opening a conversation clears its unread badge in the list and shrinks the tab badge.
- [ ] **Step 6: Long-press → Copy** puts the message text on the clipboard (paste into the composer to prove it).
- [ ] **Step 7: Rich rendering.** From web/desktop send a message with bold/italic/code/link — the mobile bubble renders the marks (link opens Safari on tap). Screenshot.
- [ ] **Step 8: Report** with screenshots; send key shots to the user via SendUserFile.

---

## Self-Review Notes

- Spec coverage (M3 bullet): chats+channels lists with unread ✓ (T4), paginated conversation ✓ (T5), bubbles + mini-renderer (paragraphs, bold/italic/code, links, mentions) ✓ (T3+T5), plain-text composer → `message.create` ✓ (T5), mark-seen ✓ (T2+T5), optimistic send ✓ (local-first, verified in T6), long-press copy ✓ (T5). Reactions explicitly deferred per spec ("react later").
- Simplifications vs web, all deliberate: mark-seen on conversation open + newest-message change (web marks per-message via IntersectionObserver — RN equivalent would be onViewableItemsChanged; upgrade later if unread counts drift), emoji/icon avatars fall back to initials, day separators and reply-threads out of scope.
- Type risks flagged inline: `WorkspaceCollections` export path (T1), `collections.workspaces` field name (T1), `useLiveInfiniteQuery` result generics (T5), `JSONContent` type-only import discipline (metro stubs @tiptap at runtime — a VALUE import crashes Hermes; `mapBlocksToContents` itself is pure and safe, verify its module `@colanode/client/lib` doesn't pull TipTap values — it lives in `lib/editor.ts` which imports @tiptap; if the barrel import drags TipTap values into the bundle, the metro stub already neutralizes them, but confirm the app still boots in T6 — this is exactly what the simulator gate is for).
