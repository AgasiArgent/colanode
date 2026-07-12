# Native Mobile M5 — Spaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Native Spaces: the Spaces tab lists workspace spaces; opening a space shows its children grouped Channels / Pages / Databases / Folders (honoring the space's custom child ordering); channels open the existing Conversation screen; everything else shows an "open on desktop" stub until M6+.

**Architecture:** Pure reuse of the web data path: spaces = nodes collection `type=='space'` (already in initial sync); children = react-db `useLiveQuery` filtered by `parentId` — the collection's `on-demand` `loadSubset` auto-hydrates pages/folders from SQLite on first query, no manual preload. Ordering/grouping via the pure, already-tested `sortSpaceChildren` / `groupSpaceChildrenByType` from `@colanode/ui/lib/spaces`. New code is presentation only.

**Spec:** `docs/superpowers/specs/2026-07-10-native-mobile-app-design.md` (milestone M5)

## Global Constraints

- Prerequisites: M1–M4 landed. Gates: `npm run compile -w @colanode/mobile`, `npm run test -w @colanode/mobile` (TS6305 → `npx turbo run build --filter=@colanode/ui` once, never commit output).
- Theme tokens only; Mycel copy rules; loud errors via `Alert.alert`; `@tiptap/*` imports type-only.
- Data facts (verified): `SpaceAttributes` = `{ type:'space', name, description?: string|null, avatar?: string|null, collaborators: Record<userId,role>, visibility, children?: Record<string,{id,index?}> }` (attributes are flattened onto `LocalSpaceNode`). Page/Folder/Database attributes all carry `name` + `avatar?` + `parentId`. Spaces order: `id asc` (web does the same). Children: `sortSpaceChildren(space, children)` then `groupSpaceChildrenByType(children)` → `{ type, label, items }[]` in fixed order Channels/Pages/Databases/Folders, empty groups skipped — both from `@colanode/ui/lib/spaces` (pure, tested upstream). Children queried by `eq(nodes.parentId, space.id)` auto-trigger `loadSubset` (initially empty → populates async; treat empty-while-loading gracefully).
- Icon mapping (type-default differentiators, mirroring web's default icon semantics): channel→`chatbubble-outline`, page→`document-text-outline`, database→`grid-outline`, folder→`folder-outline`, record→`bookmark-outline`, unknown→`ellipse-outline`. When a node has its own `avatar` set, render `NodeAvatar` instead.

---

### Task 1: Spaces navigator + spaces list

**Files:**
- Create: `apps/mobile/src/navigation/spaces-navigator.tsx`
- Rewrite: `apps/mobile/src/screens/spaces/spaces-screen.tsx`
- Modify: `apps/mobile/src/navigation/root-navigator.tsx` (Spaces tab → stack, `headerShown: false`)

**Interfaces:**
- Consumes: `useCurrentWorkspace().collections`, react-db `useLiveQuery`/`eq`, `NodeAvatar`, theme.
- Produces: `SpacesStackParamList = { SpacesHome: undefined; Space: { nodeId: string; title: string } }`; `SpaceScreen` referenced here is created in Task 2 — **Tasks 1+2 are one compile-clean series, single commit at Task 2's end.**

- [ ] **Step 1: Navigator** — `spaces-navigator.tsx` mirrors `chats-navigator.tsx`: screens `SpacesHome` (title "Spaces") and `Space` (`options={({route}) => ({ title: route.params.title })}`), same themed `screenOptions`.

- [ ] **Step 2: Spaces list** — rewrite `spaces-screen.tsx` (drops the M1 placeholder):

```tsx
import { eq, useLiveQuery } from '@tanstack/react-db';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import type { LocalSpaceNode } from '@colanode/client/types';
import { NodeAvatar } from '@colanode/mobile/components/node-avatar';
import { type SpacesStackParamList } from '@colanode/mobile/navigation/spaces-navigator';
import { useCurrentWorkspace } from '@colanode/mobile/session/current-workspace-context';
import { type Palette } from '@colanode/mobile/theme/palette';
import { useTheme } from '@colanode/mobile/theme/theme-context';
import { spacing } from '@colanode/mobile/theme/tokens';
import { fonts, typeScale } from '@colanode/mobile/theme/typography';

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
    name: { ...typeScale.body, fontFamily: fonts.bodyBold, color: palette.textPrimary },
    description: { ...typeScale.caption, color: palette.textMuted },
    empty: {
      ...typeScale.body,
      color: palette.textMuted,
      textAlign: 'center',
      padding: spacing.xl,
    },
  });

type Props = NativeStackScreenProps<SpacesStackParamList, 'SpacesHome'>;

export const SpacesScreen = ({ navigation }: Props) => {
  const { collections } = useCurrentWorkspace();
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);

  const spacesQuery = useLiveQuery(
    (q) =>
      q
        .from({ nodes: collections.nodes })
        .where(({ nodes }) => eq(nodes.type, 'space'))
        .orderBy(({ nodes }) => nodes.id, 'asc'),
    []
  );
  const spaces = (spacesQuery.data ?? []).map((node) => node as LocalSpaceNode);

  return (
    <FlatList
      style={styles.list}
      testID="spaces-list"
      data={spaces}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <Pressable
          style={styles.row}
          accessibilityRole="button"
          testID={`space-${item.id}`}
          onPress={() =>
            navigation.navigate('Space', { nodeId: item.id, title: item.name })
          }
        >
          <NodeAvatar id={item.id} avatar={item.avatar} name={item.name} size={40} />
          <View style={styles.text}>
            <Text style={styles.name} numberOfLines={1}>
              {item.name}
            </Text>
            {item.description ? (
              <Text style={styles.description} numberOfLines={1}>
                {item.description}
              </Text>
            ) : null}
          </View>
        </Pressable>
      )}
      ListEmptyComponent={
        <Text style={styles.empty}>No spaces yet. Create one on desktop.</Text>
      }
    />
  );
};
```

- [ ] **Step 3: Root navigator** — Spaces tab → `component={SpacesNavigator}`, `options={{ headerShown: false }}` (badge unchanged — spaces carry no badge in M5).

- [ ] **Step 4: Proceed to Task 2.**

---

### Task 2: Space screen — grouped children tree

**Files:**
- Create: `apps/mobile/src/screens/spaces/space-screen.tsx`

**Interfaces:**
- Consumes: `sortSpaceChildren`, `groupSpaceChildrenByType` from `@colanode/ui/lib/spaces` (verify export path — the module is `packages/ui/src/lib/spaces.ts`); react-db `useLiveQuery`; `useRadar` (channel unread dots); cross-tab navigation to `Chats → Conversation` (typed via `RootTabParamList` from M4).
- Produces: `SpaceScreen` for `SpacesStackParamList['Space']`.

- [ ] **Step 1: Implement**

```tsx
import { Ionicons } from '@expo/vector-icons';
import { eq, useLiveQuery } from '@tanstack/react-db';
import { useNavigation } from '@react-navigation/native';
import { type BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { Alert, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';

import type { LocalNode, LocalSpaceNode } from '@colanode/client/types';
import { NodeAvatar } from '@colanode/mobile/components/node-avatar';
import { type RootTabParamList } from '@colanode/mobile/navigation/root-navigator';
import { type SpacesStackParamList } from '@colanode/mobile/navigation/spaces-navigator';
import { useCurrentWorkspace } from '@colanode/mobile/session/current-workspace-context';
import { useRadar } from '@colanode/mobile/session/radar-context';
import { type Palette } from '@colanode/mobile/theme/palette';
import { useTheme } from '@colanode/mobile/theme/theme-context';
import { radius, spacing } from '@colanode/mobile/theme/tokens';
import { fonts, labelTracking, typeScale } from '@colanode/mobile/theme/typography';
import { groupSpaceChildrenByType, sortSpaceChildren } from '@colanode/ui/lib/spaces';

const TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  channel: 'chatbubble-outline',
  page: 'document-text-outline',
  database: 'grid-outline',
  folder: 'folder-outline',
  record: 'bookmark-outline',
};

const nodeTypeIcon = (type: string): keyof typeof Ionicons.glyphMap =>
  TYPE_ICONS[type] ?? 'ellipse-outline';

const nodeName = (node: LocalNode): string =>
  ((node as { name?: string | null }).name ?? '').trim() || 'Untitled';

const createStyles = (palette: Palette) =>
  StyleSheet.create({
    list: { flex: 1, backgroundColor: palette.background },
    header: {
      fontFamily: fonts.monoSemiBold,
      fontSize: typeScale.caption.fontSize,
      letterSpacing: labelTracking,
      textTransform: 'uppercase',
      color: palette.textMuted,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.lg,
      paddingBottom: spacing.sm,
      backgroundColor: palette.background,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
    },
    name: {
      ...typeScale.body,
      color: palette.textPrimary,
      flex: 1,
    },
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

type Props = NativeStackScreenProps<SpacesStackParamList, 'Space'>;

export const SpaceScreen = ({ route }: Props) => {
  const { nodeId } = route.params;
  const { collections } = useCurrentWorkspace();
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const radar = useRadar();
  const tabNavigation =
    useNavigation<BottomTabNavigationProp<RootTabParamList>>();

  const spaceQuery = useLiveQuery(
    (q) =>
      q
        .from({ nodes: collections.nodes })
        .where(({ nodes }) => eq(nodes.id, nodeId))
        .findOne(),
    [nodeId]
  );
  const childrenQuery = useLiveQuery(
    (q) =>
      q
        .from({ nodes: collections.nodes })
        .where(({ nodes }) => eq(nodes.parentId, nodeId)),
    [nodeId]
  );

  const space = spaceQuery.data as LocalSpaceNode | undefined;
  const sections = useMemo(() => {
    if (!space) return [];
    const sorted = sortSpaceChildren(space, (childrenQuery.data ?? []) as LocalNode[]);
    return groupSpaceChildrenByType(sorted).map((group) => ({
      title: group.label,
      data: group.items,
    }));
  }, [space, childrenQuery.data]);

  const open = (node: LocalNode) => {
    if (node.type === 'channel') {
      tabNavigation.navigate('Chats', {
        screen: 'Conversation',
        params: { nodeId: node.id, title: nodeName(node) },
      });
      return;
    }
    Alert.alert(
      'Not available on mobile yet',
      'Open this on desktop or web to see it.'
    );
  };

  return (
    <SectionList
      style={styles.list}
      testID="space-children"
      sections={sections}
      keyExtractor={(item) => item.id}
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) => (
        <Text style={styles.header}>{section.title}</Text>
      )}
      renderItem={({ item }) => {
        const unread =
          item.type === 'channel' ? radar.getNodeState(item.id) : null;
        return (
          <Pressable
            style={styles.row}
            accessibilityRole="button"
            testID={`space-child-${item.id}`}
            onPress={() => open(item)}
          >
            {item.avatar ? (
              <NodeAvatar
                id={item.id}
                avatar={item.avatar}
                name={nodeName(item)}
                size={28}
              />
            ) : (
              <Ionicons
                name={nodeTypeIcon(item.type)}
                size={20}
                color={palette.textMuted}
              />
            )}
            <Text style={styles.name} numberOfLines={1}>
              {nodeName(item)}
            </Text>
            {unread?.hasUnread ? <View style={styles.dot} /> : null}
          </Pressable>
        );
      }}
      ListEmptyComponent={
        <Text style={styles.empty}>Nothing here yet.</Text>
      }
    />
  );
};
```

Executor notes: verify `sortSpaceChildren`/`groupSpaceChildrenByType` signatures against `packages/ui/src/lib/spaces.ts` before writing (group label field name, `LocalSpaceNode` param). The children query result is empty while `loadSubset` hydrates — the empty state doubles as the loading state (acceptable: hydration is a local SQLite read, sub-100ms).

- [ ] **Step 2: Gates + commit (Tasks 1+2)**

```bash
npm run test -w @colanode/mobile && npm run compile -w @colanode/mobile
cd apps/mobile && npx expo export --platform ios --output-dir /tmp/expo-export-m5 && cd ../..
git add apps/mobile/src
git commit -m "feat(mobile): spaces — space list and grouped children tree"
```

---

### Task 3: Simulator verification (manual gate, no commit)

Mac workflow as before. KNOWN ENVIRONMENT ISSUE from the M4 run: the Mac build clone's native build fails with `exsqlite3_*` errors in expo-sqlite — fix FIRST with `cd ~/workspace/colanode-build/apps/mobile && npx expo prebuild -p ios --clean` then `npx expo run:ios --device 50B1BC35-75C8-406E-977B-6E731AE92636` (login shell, nvm 24.15.0); expect a long full rebuild — start it EARLY and poll the log. Test session: mcp-agent@colanode.test on `http://100.74.217.216:3001` — NOTE: correct IP is `100.74.217.116` (typo guard), persisted session likely already signed in. Test data: the workspace has channels; if it has no space with pages/folders, create them server-side via the bootEngine injector recipe (`node.list` shows a "Discussions" channel under a space) or via the colanode MCP tooling (create_page under the space).

- [ ] **Step 1: Build (with clean prebuild), launch, confirm signed in.**
- [ ] **Step 2: Spaces tab** — spaces list renders with avatar/initials, names, descriptions. Screenshot.
- [ ] **Step 3: Open a space** — children grouped under mono uppercase CHANNELS / PAGES / ... headers, type icons for avatar-less nodes, channel rows show spore dots when unread. Screenshot.
- [ ] **Step 4: Tap a channel** → lands on the Conversation screen (cross-tab); tap a page/database → "Not available on mobile yet" alert. Screenshot.
- [ ] **Step 5: On-demand hydration proof** — create a NEW page in the space from the server side (injector/MCP) while the space screen is open: the page appears in the PAGES group live. Screenshot.
- [ ] **Step 6: Report** + screenshots via SendUserFile.

---

## Self-Review Notes

- Spec coverage (M5): space list → node tree ✓ (T1+T2), channels open chat ✓, pages open the M6 viewer — M6 not built yet, so pages get the same "open on desktop" stub as databases/folders (plan-level decision consistent with the spec's sequencing; the `open()` dispatch is the single place M6 will hook into).
- No new pure logic to TDD — ordering/grouping reuse `@colanode/ui/lib/spaces` (tested upstream); the icon map is a trivial lookup (not tested per testing standards).
- Risks flagged: `lib/spaces` export names (executor verifies), on-demand hydration latency (empty-as-loading accepted), cross-tab navigation types come from M4's `NavigatorScreenParams` work.
