# Native Mobile M1 — Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the WebView UI in `apps/mobile` with a native React Native shell: bottom-tab navigation, an in-process `window.colanode` shim over `app.mediator`, provisional theme tokens, and a proof screen rendering live `server.list` data through a reused `packages/ui` hook.

**Architecture:** `AppService` (all of `packages/client`) already runs natively on Hermes; the WebView was only a renderer talking to `app.mediator` over a superjson bridge. This milestone deletes the WebView layer and fulfills the same `ColanodeWindowApi` contract (`packages/ui/src/window.ts`) with direct in-process calls, so the DOM-free hooks in `packages/ui` (`use-query`, `use-live-query`, `use-mutation`, `lib/query.ts`) are reused verbatim. New code is only: shim, navigation, screens, tokens.

**Tech Stack:** Expo ~54 / React Native 0.81.5 / React 19.1.0 (Hermes), react-navigation v7 (bottom-tabs), @tanstack/react-query v5, vitest v4 for unit tests.

**Spec:** `docs/superpowers/specs/2026-07-10-native-mobile-app-design.md`

## Global Constraints

- Monorepo with npm workspaces: install deps from the repo root with `npm install <pkg> -w @colanode/mobile`; `npx expo install` runs inside `apps/mobile`.
- All paths below are relative to the repo root.
- Import style inside `apps/mobile`: always `@colanode/mobile/...`, `@colanode/client/...`, `@colanode/ui/...` (tsconfig paths; Metro resolves them via Expo's built-in tsconfig-paths support — this is how `@colanode/mobile/lib/assets` already resolves today).
- From `packages/ui` import ONLY `hooks/*`, `lib/query`, `window` — never `components/*` (DOM).
- React versions differ across the monorepo (app: 19.1.0, packages/ui declares ^19.2.x) — every bundler must dedupe react (web/desktop do it in Vite; Task 1 adds the Metro equivalent).
- `assets/ui/index.html` is a gitignored Vite build artifact; it exists only until Task 7 removes its last consumer. Never commit it.
- Keep `react-native-webview` installed even after Task 7 — the M7 editor island uses it (documented in the spec).
- Conventional commits (`feat(mobile): ...`, `chore(mobile): ...`). One logical change per commit.
- Typecheck gate for every task: `npm run compile -w @colanode/mobile` (script added in Task 1). Unit test gate: `npm run test -w @colanode/mobile` (script added in Task 3).

---

### Task 1: Dependencies, Metro react-dedupe, and the `@colanode/ui` bundling spike

**Files:**
- Modify: `apps/mobile/package.json` (deps + `compile` script)
- Modify: `apps/mobile/metro.config.js`
- Temporarily modify (probe, reverted before commit): `apps/mobile/src/index.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: resolvable `@react-navigation/native@^7`, `@react-navigation/bottom-tabs@^7`, `react-native-screens`, `@tanstack/react-query@^5.96.1` for all later tasks; Metro guaranteed to serve a single React instance to `packages/ui` hooks.

- [ ] **Step 1: Install dependencies**

```bash
npm install @react-navigation/native@^7 @react-navigation/bottom-tabs@^7 @tanstack/react-query@^5.96.1 -w @colanode/mobile
cd apps/mobile && npx expo install react-native-screens && cd ../..
```

Expected: `apps/mobile/package.json` gains the four deps (react-native-screens at the Expo-54-pinned version, e.g. `~4.x`).

- [ ] **Step 2: Add the `compile` script**

In `apps/mobile/package.json` `scripts`, add (parity with other packages):

```json
"compile": "tsc --noEmit",
```

- [ ] **Step 3: Add react dedupe to Metro**

Replace the resolver block in `apps/mobile/metro.config.js` so the whole file reads:

```js
// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Kysely's FileMigrationProvider loads migration files via a runtime dynamic
// `import()`. It is a Node-only code path that the mobile client never uses
// (migrations are supplied inline via `new Migrator({ provider: { getMigrations } })`),
// but it still gets pulled into the bundle through `kysely`'s barrel export and
// Hermes cannot compile the dynamic `import()` ("Invalid expression"). Resolve
// that module to an empty stub for React Native so the bundle stays Hermes-safe.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.includes('file-migration-provider')) {
    return { type: 'empty' };
  }

  // The monorepo carries two React versions (this app: 19.1.0; packages/ui
  // declares ^19.2.x, which npm may install under packages/ui/node_modules).
  // Shared @colanode/ui hooks must resolve the SAME React instance as the
  // app, or the hooks dispatcher is null at runtime ("Cannot read properties
  // of null (reading 'useRef')"). Force every react resolution to originate
  // from the app directory — the Metro equivalent of `resolve.dedupe` in the
  // web/desktop Vite configs.
  if (moduleName === 'react' || moduleName.startsWith('react/')) {
    return context.resolveRequest(
      { ...context, originModulePath: path.join(__dirname, 'package.json') },
      moduleName,
      platform
    );
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
```

- [ ] **Step 4: Spike — prove Metro bundles a `@colanode/ui` module**

The WebView asset must exist for the current `src/lib/assets.ts` import (removed later in Task 7):

```bash
npm run build:ui -w @colanode/mobile
```

Append a probe to `apps/mobile/src/index.ts` (AFTER the existing lines):

```ts
// eslint-disable-next-line import/order -- temporary Metro resolution spike, removed before commit
import { buildQueryClient } from '@colanode/ui/lib/query';
console.log('[spike] @colanode/ui resolves:', typeof buildQueryClient);
```

Run:

```bash
cd apps/mobile && npx expo export --platform ios --output-dir /tmp/expo-export-spike && cd ../..
```

Expected: export completes without resolution errors (bundle written to `/tmp/expo-export-spike`).

**Contingency (only if export fails resolving `@colanode/ui/lib/query`):** Expo's tsconfig-paths did not cover it; add an explicit alias inside `resolveRequest` in `metro.config.js`, before the final return:

```js
  if (moduleName.startsWith('@colanode/ui/')) {
    return context.resolveRequest(
      { ...context, originModulePath: path.join(__dirname, 'package.json') },
      path.join(__dirname, '../../packages/ui/src', moduleName.slice('@colanode/ui/'.length)),
      platform
    );
  }
```

Re-run the export; it must pass before proceeding.

- [ ] **Step 5: Revert the probe**

Remove the two probe lines from `apps/mobile/src/index.ts` (file returns to its committed state — verify with `git diff apps/mobile/src/index.ts` → empty).

- [ ] **Step 6: Typecheck**

Run: `npm run compile -w @colanode/mobile`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/package.json apps/mobile/metro.config.js package-lock.json
git commit -m "chore(mobile): add navigation/query deps, metro react dedupe, compile script"
```

---

### Task 2: Provisional theme tokens

**Files:**
- Create: `apps/mobile/src/theme/tokens.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `tokens` const — `tokens.colors.{background,surface,border,textPrimary,textSecondary,textMuted,accent,danger,success}`, `tokens.spacing.{xs,sm,md,lg,xl}`, `tokens.fontSize.{xs,sm,md,lg,xl}`, `tokens.radius.{sm,md,lg}`. All later UI tasks import this; the claude.ai/design token drop later replaces ONLY this file.

- [ ] **Step 1: Create the token module**

```ts
// Provisional neutral tokens for the M1 shell. The real design tokens from
// the claude.ai/design pass (see docs/superpowers/specs/2026-07-09-rebrand-
// design-prompts.md) replace the values in this file — screens must never
// hardcode colors/sizes, only reference tokens.
export const tokens = {
  colors: {
    background: '#ffffff',
    surface: '#f5f5f5',
    border: '#e5e5e5',
    textPrimary: '#171717',
    textSecondary: '#525252',
    textMuted: '#a3a3a3',
    accent: '#171717',
    danger: '#dc2626',
    success: '#16a34a',
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  fontSize: { xs: 12, sm: 14, md: 16, lg: 20, xl: 24 },
  radius: { sm: 6, md: 10, lg: 16 },
} as const;
```

- [ ] **Step 2: Typecheck**

Run: `npm run compile -w @colanode/mobile`
Expected: exit 0. (Constants — no unit test per testing standards.)

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/theme/tokens.ts
git commit -m "feat(mobile): provisional theme tokens for native shell"
```

---

### Task 3: `createColanodeApi` factory (TDD) + vitest setup

**Files:**
- Create: `apps/mobile/vitest.config.ts`
- Create: `apps/mobile/src/data/colanode-api.ts`
- Test: `apps/mobile/src/data/colanode-api.test.ts`
- Modify: `apps/mobile/package.json` (vitest devDep + `test` script)

**Interfaces:**
- Consumes: `ColanodeWindowApi` type from `@colanode/ui/window`; `AppService` type from `@colanode/client/services`; `MutationInput` from `@colanode/client/mutations`; `QueryInput` from `@colanode/client/queries` (all type-only — the factory has zero runtime imports, which is what makes it testable in node).
- Produces: `createColanodeApi(deps: ColanodeApiDeps): ColanodeWindowApi` and `ColanodeApiDeps { mediator, windowId, openUrl, push }` — Task 4 wires it to RN.

- [ ] **Step 1: Add vitest**

```bash
npm install -D vitest@^4.1.2 -w @colanode/mobile
```

In `apps/mobile/package.json` `scripts`, add:

```json
"test": "vitest run",
```

Create `apps/mobile/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 2: Write the failing tests**

Create `apps/mobile/src/data/colanode-api.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

import type { MutationInput } from '@colanode/client/mutations';
import { createColanodeApi, type ColanodeApiDeps } from './colanode-api';

const buildStub = () => {
  const mediator = {
    executeQuery: vi.fn().mockResolvedValue(['query-result']),
    executeQueryAndSubscribe: vi.fn().mockResolvedValue(['live-result']),
    unsubscribeQuery: vi.fn(),
    executeMutation: vi
      .fn()
      .mockResolvedValue({ success: true, output: { id: 'srv1' } }),
  };

  const deps: ColanodeApiDeps = {
    mediator: mediator as unknown as ColanodeApiDeps['mediator'],
    windowId: 'win-1',
    openUrl: vi.fn().mockResolvedValue(undefined),
    push: {
      enable: vi.fn().mockResolvedValue(true),
      disable: vi.fn().mockResolvedValue(undefined),
      getState: vi.fn().mockResolvedValue('disabled'),
      isSupported: () => false,
    },
  };

  return { deps, mediator };
};

describe('createColanodeApi', () => {
  it('delegates executeQuery to the mediator and returns its result', async () => {
    const { deps, mediator } = buildStub();
    const api = createColanodeApi(deps);

    const result = await api.executeQuery({ type: 'server.list' });

    expect(mediator.executeQuery).toHaveBeenCalledWith({ type: 'server.list' });
    expect(result).toEqual(['query-result']);
  });

  it('injects its windowId between key and input when subscribing', async () => {
    const { deps, mediator } = buildStub();
    const api = createColanodeApi(deps);

    await api.executeQueryAndSubscribe('key-1', { type: 'server.list' });

    expect(mediator.executeQueryAndSubscribe).toHaveBeenCalledWith('key-1', 'win-1', {
      type: 'server.list',
    });
  });

  it('unsubscribes with the same windowId', async () => {
    const { deps, mediator } = buildStub();
    const api = createColanodeApi(deps);

    await api.unsubscribeQuery('key-1');

    expect(mediator.unsubscribeQuery).toHaveBeenCalledWith('key-1', 'win-1');
  });

  it('passes the mutation result envelope through unchanged', async () => {
    const { deps } = buildStub();
    const api = createColanodeApi(deps);

    const input = {
      type: 'server.create',
      url: 'https://example.com/config',
    } as MutationInput;
    const result = await api.executeMutation(input);

    expect(result).toEqual({ success: true, output: { id: 'srv1' } });
  });

  it('resolves init with success — native boot gates readiness itself', async () => {
    const { deps } = buildStub();
    const api = createColanodeApi(deps);

    await expect(api.init()).resolves.toBe('success');
  });

  it('rejects saveTempFile as not implemented on mobile', async () => {
    const { deps } = buildStub();
    const api = createColanodeApi(deps);

    await expect(api.saveTempFile({} as File)).rejects.toThrow(/not implemented/i);
  });
});
```

- [ ] **Step 3: Run tests — verify they fail**

Run: `npm run test -w @colanode/mobile`
Expected: FAIL — cannot resolve `./colanode-api`.

- [ ] **Step 4: Implement the factory**

Create `apps/mobile/src/data/colanode-api.ts`:

```ts
import type { MutationInput } from '@colanode/client/mutations';
import type { QueryInput } from '@colanode/client/queries';
import type { AppService } from '@colanode/client/services';
import type { ColanodeWindowApi } from '@colanode/ui/window';

type Mediator = AppService['mediator'];

export interface ColanodeApiDeps {
  mediator: Pick<
    Mediator,
    | 'executeQuery'
    | 'executeQueryAndSubscribe'
    | 'unsubscribeQuery'
    | 'executeMutation'
  >;
  windowId: string;
  openUrl: (url: string) => Promise<void>;
  push: ColanodeWindowApi['push'];
}

// In-process implementation of the ColanodeWindowApi contract
// (packages/ui/src/window.ts) — the fourth transport after the web Comlink
// worker, the Electron IPC bridge, and the removed mobile WebView bridge.
// Pure factory with zero runtime imports so it is unit-testable in node;
// RN wiring (Linking, push, global assignment) lives in install-shim.ts.
export const createColanodeApi = (deps: ColanodeApiDeps): ColanodeWindowApi => {
  const { mediator, windowId, openUrl, push } = deps;

  return {
    // Native boot renders the UI only after AppService.init() succeeded, so
    // consumers asking init() are by definition post-init.
    init: async () => 'success',
    reset: async () => {
      throw new Error('reset is not supported in the native mobile app yet');
    },
    executeMutation: <T extends MutationInput>(input: T) =>
      mediator.executeMutation(input),
    executeQuery: <T extends QueryInput>(input: T) =>
      mediator.executeQuery(input),
    executeQueryAndSubscribe: <T extends QueryInput>(key: string, input: T) =>
      mediator.executeQueryAndSubscribe(key, windowId, input),
    unsubscribeQuery: async (key: string) => {
      mediator.unsubscribeQuery(key, windowId);
    },
    saveTempFile: async () => {
      throw new Error('saveTempFile is not implemented on mobile');
    },
    openExternalUrl: (url: string) => openUrl(url),
    showItemInFolder: async () => {
      // No-op, same as web.
    },
    showFileSaveDialog: async () => undefined,
    push,
  };
};
```

- [ ] **Step 5: Run tests — verify they pass**

Run: `npm run test -w @colanode/mobile`
Expected: 6 passed.

- [ ] **Step 6: Typecheck**

Run: `npm run compile -w @colanode/mobile`
Expected: exit 0. If the generic delegations mismatch the real mediator signatures, fix the factory against `packages/client/src/handlers/mediator.ts` (source of truth) — do not cast.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/vitest.config.ts apps/mobile/src/data/colanode-api.ts apps/mobile/src/data/colanode-api.test.ts apps/mobile/package.json package-lock.json
git commit -m "feat(mobile): in-process ColanodeWindowApi factory with vitest coverage"
```

---

### Task 4: Shim installation (RN wiring)

**Files:**
- Create: `apps/mobile/src/data/install-shim.ts`

**Interfaces:**
- Consumes: `createColanodeApi`/`ColanodeApiDeps` (Task 3); `eventBus` from `@colanode/client/lib`; `generateId, IdType` from `@colanode/core`; `MobilePushService` from `@colanode/mobile/services/push-service`; RN `Linking`, `Platform`.
- Produces: `installColanodeShim(app: AppService, pushService: MobilePushService): void` — called once by the new `app.tsx` (Task 7) after `app.init()`; assigns `window.colanode` and `window.eventBus`.

- [ ] **Step 1: Implement install-shim**

Create `apps/mobile/src/data/install-shim.ts`:

```ts
import { Linking, Platform } from 'react-native';

import { eventBus } from '@colanode/client/lib';
import type { AppService } from '@colanode/client/services';
import { generateId, IdType } from '@colanode/core';
import { createColanodeApi } from '@colanode/mobile/data/colanode-api';
import { MobilePushService } from '@colanode/mobile/services/push-service';

// Fulfills the window.colanode / window.eventBus contract that the shared
// packages/ui hooks (use-query, use-live-query, lib/query.ts) depend on.
// On Hermes `window === global`, so the web contract applies verbatim.
export const installColanodeShim = (
  app: AppService,
  pushService: MobilePushService
): void => {
  const windowId = generateId(IdType.Window);

  // shortcut: token kept in module scope only (mirrors the pre-existing
  // WebView-era behavior) — persist alongside the apns subscription when
  // push settings UX lands in M2+.
  let pushToken: string | null = null;

  window.colanode = createColanodeApi({
    mediator: app.mediator,
    windowId,
    openUrl: async (url) => {
      await Linking.openURL(url);
    },
    push: {
      enable: async (userId) => {
        const token = await pushService.enable();
        if (!token) {
          return false;
        }

        pushToken = token;
        const result = await app.mediator.executeMutation({
          type: 'apnsSubscription.create',
          userId,
          deviceToken: token,
        });
        return result.success;
      },
      disable: async (userId) => {
        if (pushToken) {
          await app.mediator.executeMutation({
            type: 'apnsSubscription.delete',
            userId,
            deviceToken: pushToken,
          });
          pushToken = null;
        }
        await pushService.disable();
      },
      getState: () => pushService.getState(),
      isSupported: () => Platform.OS === 'ios',
    },
  });

  window.eventBus = eventBus;
};
```

Note: the push wiring transplants the exact logic from the `push_enable`/`push_disable`/`push_get_state` bridge branches in the current `apps/mobile/src/app.tsx:290-330` — compare against that file before it is deleted in Task 7. If `pushService.getState()`'s return type or `isSupported` shape differs from `ColanodeWindowApi['push']`, adapt HERE (not in packages/ui).

- [ ] **Step 2: Typecheck**

Run: `npm run compile -w @colanode/mobile`
Expected: exit 0. (RN-importing module — covered by typecheck + the Task 8 simulator gate, not node unit tests.)

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/data/install-shim.ts
git commit -m "feat(mobile): window.colanode shim wiring over app mediator"
```

---

### Task 5: Navigation skeleton + placeholder screens

**Files:**
- Create: `apps/mobile/src/navigation/root-navigator.tsx`
- Create: `apps/mobile/src/components/placeholder-screen.tsx`
- Create: `apps/mobile/src/screens/chats/chats-screen.tsx`
- Create: `apps/mobile/src/screens/spaces/spaces-screen.tsx`
- Create: `apps/mobile/src/screens/inbox/inbox-screen.tsx`

**Interfaces:**
- Consumes: `tokens` (Task 2); `@react-navigation/bottom-tabs`; `@expo/vector-icons` (ships inside the `expo` package — no new dep).
- Produces: `RootNavigator` component and `RootTabParamList` type — consumed by the new `app.tsx` (Task 7). `SettingsScreen` referenced here is created in Task 6, so **Task 6 must land before this task typechecks** — implement Tasks 5 and 6 in one working session, commit together at the end of Task 6.

- [ ] **Step 1: Placeholder screen component**

Create `apps/mobile/src/components/placeholder-screen.tsx`:

```tsx
import { StyleSheet, Text, View } from 'react-native';

import { tokens } from '@colanode/mobile/theme/tokens';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.sm,
    backgroundColor: tokens.colors.background,
  },
  title: {
    fontSize: tokens.fontSize.lg,
    fontWeight: '600',
    color: tokens.colors.textPrimary,
  },
  subtitle: {
    fontSize: tokens.fontSize.sm,
    color: tokens.colors.textMuted,
  },
});

interface PlaceholderScreenProps {
  title: string;
}

export const PlaceholderScreen = ({ title }: PlaceholderScreenProps) => (
  <View style={styles.container} testID={`placeholder-${title.toLowerCase()}`}>
    <Text style={styles.title}>{title}</Text>
    <Text style={styles.subtitle}>Coming soon</Text>
  </View>
);
```

- [ ] **Step 2: Tab screens**

Create `apps/mobile/src/screens/chats/chats-screen.tsx`:

```tsx
import { PlaceholderScreen } from '@colanode/mobile/components/placeholder-screen';

export const ChatsScreen = () => <PlaceholderScreen title="Chats" />;
```

Create `apps/mobile/src/screens/spaces/spaces-screen.tsx`:

```tsx
import { PlaceholderScreen } from '@colanode/mobile/components/placeholder-screen';

export const SpacesScreen = () => <PlaceholderScreen title="Spaces" />;
```

Create `apps/mobile/src/screens/inbox/inbox-screen.tsx`:

```tsx
import { PlaceholderScreen } from '@colanode/mobile/components/placeholder-screen';

export const InboxScreen = () => <PlaceholderScreen title="Inbox" />;
```

- [ ] **Step 3: Root navigator**

Create `apps/mobile/src/navigation/root-navigator.tsx`:

```tsx
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { ChatsScreen } from '@colanode/mobile/screens/chats/chats-screen';
import { InboxScreen } from '@colanode/mobile/screens/inbox/inbox-screen';
import { SettingsScreen } from '@colanode/mobile/screens/settings/settings-screen';
import { SpacesScreen } from '@colanode/mobile/screens/spaces/spaces-screen';
import { tokens } from '@colanode/mobile/theme/tokens';

// Per-tab native stacks arrive with the first inner screens (M2 auth flows,
// M3 conversation screen) — a tabs-only skeleton is the M1 scope.
export type RootTabParamList = {
  Chats: undefined;
  Spaces: undefined;
  Inbox: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

const tabIcons: Record<keyof RootTabParamList, keyof typeof Ionicons.glyphMap> =
  {
    Chats: 'chatbubbles-outline',
    Spaces: 'grid-outline',
    Inbox: 'notifications-outline',
    Settings: 'settings-outline',
  };

export const RootNavigator = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      tabBarActiveTintColor: tokens.colors.accent,
      tabBarInactiveTintColor: tokens.colors.textMuted,
      tabBarIcon: ({ color, size }) => (
        <Ionicons name={tabIcons[route.name]} color={color} size={size} />
      ),
    })}
  >
    <Tab.Screen name="Chats" component={ChatsScreen} />
    <Tab.Screen name="Spaces" component={SpacesScreen} />
    <Tab.Screen name="Inbox" component={InboxScreen} />
    <Tab.Screen name="Settings" component={SettingsScreen} />
  </Tab.Navigator>
);
```

- [ ] **Step 4: Proceed directly to Task 6** (shared typecheck + commit there).

---

### Task 6: Settings screen with live `server.list` (the packages/ui-hook proof)

**Files:**
- Create: `apps/mobile/src/screens/settings/settings-screen.tsx`

**Interfaces:**
- Consumes: `useLiveQuery` from `@colanode/ui/hooks/use-live-query` (the reuse proof — DO NOT write a local query hook); `Server` type from `@colanode/client/types`; `tokens`.
- Produces: `SettingsScreen` — referenced by `RootNavigator` (Task 5). M2 extends this screen with account info/logout.

- [ ] **Step 1: Implement the screen**

Create `apps/mobile/src/screens/settings/settings-screen.tsx`:

```tsx
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import { Server } from '@colanode/client/types';
import { tokens } from '@colanode/mobile/theme/tokens';
import { useLiveQuery } from '@colanode/ui/hooks/use-live-query';

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.background,
  },
  list: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  header: {
    fontSize: tokens.fontSize.sm,
    fontWeight: '600',
    color: tokens.colors.textMuted,
    textTransform: 'uppercase',
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.lg,
    paddingBottom: tokens.spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.colors.border,
    gap: tokens.spacing.md,
  },
  rowText: {
    flex: 1,
    gap: tokens.spacing.xs,
  },
  name: {
    fontSize: tokens.fontSize.md,
    fontWeight: '600',
    color: tokens.colors.textPrimary,
  },
  domain: {
    fontSize: tokens.fontSize.sm,
    color: tokens.colors.textSecondary,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  empty: {
    fontSize: tokens.fontSize.sm,
    color: tokens.colors.textMuted,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
  },
  error: {
    fontSize: tokens.fontSize.sm,
    color: tokens.colors.danger,
  },
});

const ServerRow = ({ server }: { server: Server }) => (
  <View style={styles.row} testID={`server-${server.domain}`}>
    <View style={styles.rowText}>
      <Text style={styles.name}>{server.name}</Text>
      <Text style={styles.domain}>
        {server.domain} · v{server.version}
      </Text>
    </View>
    <View
      style={[
        styles.statusDot,
        {
          backgroundColor: server.state?.isAvailable
            ? tokens.colors.success
            : tokens.colors.textMuted,
        },
      ]}
    />
  </View>
);

export const SettingsScreen = () => {
  const serverList = useLiveQuery({ type: 'server.list' });

  if (serverList.isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator testID="settings-loading-indicator" />
      </View>
    );
  }

  if (serverList.isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Failed to load servers.</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      testID="settings-server-list"
      data={serverList.data}
      keyExtractor={(server) => server.domain}
      renderItem={({ item }) => <ServerRow server={item} />}
      ListHeaderComponent={<Text style={styles.header}>Servers</Text>}
      ListEmptyComponent={<Text style={styles.empty}>No servers added yet</Text>}
    />
  );
};
```

- [ ] **Step 2: Typecheck (covers Tasks 5+6)**

Run: `npm run compile -w @colanode/mobile`
Expected: exit 0.

- [ ] **Step 3: Commit (Tasks 5+6 together)**

```bash
git add apps/mobile/src/navigation apps/mobile/src/components apps/mobile/src/screens
git commit -m "feat(mobile): tab navigation skeleton + settings servers screen via @colanode/ui hook"
```

---

### Task 7: Rewrite `app.tsx`, delete the WebView layer

**Files:**
- Modify: `apps/mobile/src/app.tsx` (full rewrite below)
- Modify: `apps/mobile/src/lib/assets.ts` (drop `indexHtmlAsset`)
- Modify: `apps/mobile/src/services/push-service.ts` (inline `MobilePushState`)
- Modify: `apps/mobile/package.json` (drop WebView-build scripts/deps)
- Modify: `apps/mobile/tsconfig.json` (drop `assets/ui/index.html` from `include`)
- Modify: `apps/mobile/README.md` (architecture note)
- Delete: `apps/mobile/src/ui/` (main.tsx, root.tsx, mobile-fonts.tsx), `apps/mobile/src/lib/types.ts`, `apps/mobile/vite.config.ts`, `apps/mobile/postcss.config.mjs`, `apps/mobile/index.html`

**Interfaces:**
- Consumes: `installColanodeShim` (Task 4), `RootNavigator` (Task 5), `buildQueryClient` from `@colanode/ui/lib/query`, `tokens` (Task 2).
- Produces: the shipping native app entry. Nothing later in M1 depends on it except the simulator gate (Task 8).

- [ ] **Step 1: Move `MobilePushState` into the push service**

In `apps/mobile/src/services/push-service.ts`, replace the import of `MobilePushState` from `@colanode/mobile/lib/types` with a local definition at the top of the file (keep the same union — it mirrors `WebPushState` in `packages/ui/src/window.ts`):

```ts
export type MobilePushState = 'unsupported' | 'denied' | 'enabled' | 'disabled';
```

(The "defined in lib/types so the WebView bundle can import it" constraint dies with the WebView.)

- [ ] **Step 2: Rewrite `apps/mobile/src/app.tsx`**

Full new content:

```tsx
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { modelName } from 'expo-device';
import {
  Component,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppMeta, AppService } from '@colanode/client/services';
import { installColanodeShim } from '@colanode/mobile/data/install-shim';
import { copyAssets } from '@colanode/mobile/lib/assets';
import { RootNavigator } from '@colanode/mobile/navigation/root-navigator';
import { MobileFileSystem } from '@colanode/mobile/services/file-system';
import { MobileKyselyService } from '@colanode/mobile/services/kysely-service';
import { MobilePathService } from '@colanode/mobile/services/path-service';
import { MobilePushService } from '@colanode/mobile/services/push-service';
import { tokens } from '@colanode/mobile/theme/tokens';
import { buildQueryClient } from '@colanode/ui/lib/query';

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.background,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
    backgroundColor: tokens.colors.background,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: tokens.colors.textPrimary,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    color: tokens.colors.textSecondary,
    textAlign: 'center',
  },
  errorRetryButton: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.colors.accent,
    minHeight: 48,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorRetryText: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.colors.background,
  },
});

// React Native's `global`/`window` is not a DOM EventTarget, so it has no
// `addEventListener('error' | 'unhandledrejection', ...)`. The native-side
// equivalent for uncaught JS exceptions is `ErrorUtils`. We chain through the
// previously installed handler (RN's own redbox/exception reporter) so
// behavior is unchanged — we only add a loud, contextual log on top of it.
const defaultErrorHandler = ErrorUtils.getGlobalHandler();
ErrorUtils.setGlobalHandler((error, isFatal) => {
  console.error('[Mobile] Uncaught global error', error, { isFatal });
  defaultErrorHandler(error, isFatal);
});

interface MobileErrorStateProps {
  testID: string;
  title: string;
  message: string;
  retryTestID: string;
  onRetry: () => void;
}

const MobileErrorState = ({
  testID,
  title,
  message,
  retryTestID,
  onRetry,
}: MobileErrorStateProps) => {
  return (
    <View testID={testID} style={styles.errorContainer}>
      <Text style={styles.errorTitle}>{title}</Text>
      <Text style={styles.errorMessage}>{message}</Text>
      <Pressable
        testID={retryTestID}
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Try again"
        style={styles.errorRetryButton}
      >
        <Text style={styles.errorRetryText}>Try again</Text>
      </Pressable>
    </View>
  );
};

interface MobileErrorBoundaryState {
  error: Error | null;
}

// Wraps the native app tree so a render-time error shows a visible,
// test-observable failure state instead of a blank screen — the React Native
// counterpart of the shared web AppErrorBoundary.
class MobileErrorBoundary extends Component<
  { children: ReactNode },
  MobileErrorBoundaryState
> {
  state: MobileErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): MobileErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(
      '[Mobile] Uncaught render error in app tree',
      error,
      errorInfo.componentStack
    );
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) {
      return this.props.children;
    }

    return (
      <MobileErrorState
        testID="app-error-boundary"
        title="Something went wrong"
        message={error.message || 'The app ran into an unexpected error.'}
        retryTestID="app-error-boundary-retry-button"
        onRetry={this.reset}
      />
    );
  }
}

type BootState =
  | { phase: 'initializing' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; queryClient: QueryClient };

export const App = () => {
  const app = useRef<AppService | null>(null);
  const pushService = useRef(new MobilePushService()).current;
  const [boot, setBoot] = useState<BootState>({ phase: 'initializing' });

  const initialize = useCallback(async () => {
    setBoot({ phase: 'initializing' });
    try {
      const paths = new MobilePathService();
      await copyAssets(paths);

      const appMeta: AppMeta = {
        type: 'mobile',
        platform: modelName ?? 'unknown',
      };

      const appService = new AppService(
        appMeta,
        new MobileFileSystem(),
        new MobileKyselyService(),
        paths
      );

      await appService.migrate();
      await appService.init();

      app.current = appService;
      // Order matters: buildQueryClient() subscribes to window.eventBus,
      // which the shim assigns.
      installColanodeShim(appService, pushService);
      setBoot({ phase: 'ready', queryClient: buildQueryClient() });
    } catch (error) {
      console.error('[Mobile] App initialization failed', error);
      setBoot({
        phase: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to initialize the app.',
      });
    }
  }, [pushService]);

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (boot.phase === 'initializing') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator testID="app-loading-indicator" />
      </View>
    );
  }

  if (boot.phase === 'error') {
    return (
      <MobileErrorState
        testID="app-init-error"
        title="Failed to start"
        message={boot.message}
        retryTestID="app-init-error-retry-button"
        onRetry={initialize}
      />
    );
  }

  return (
    <SafeAreaProvider>
      <MobileErrorBoundary>
        <QueryClientProvider client={boot.queryClient}>
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
        </QueryClientProvider>
      </MobileErrorBoundary>
    </SafeAreaProvider>
  );
};
```

- [ ] **Step 3: Drop the WebView asset from `lib/assets.ts`**

In `apps/mobile/src/lib/assets.ts`: remove the line `import indexHtmlAsset from '../../assets/ui/index.html';` and remove `indexHtmlAsset` from the `export { ... }` block. Everything else (emoji/icon DB copying) stays.

- [ ] **Step 4: Delete the WebView layer**

```bash
git rm -r apps/mobile/src/ui
git rm apps/mobile/src/lib/types.ts apps/mobile/vite.config.ts apps/mobile/postcss.config.mjs apps/mobile/index.html
```

Verify nothing references the deleted modules:

```bash
grep -rn "lib/types\|src/ui\|indexHtmlAsset" apps/mobile/src
```

Expected: no matches.

- [ ] **Step 5: Clean `package.json` and `tsconfig.json`**

`apps/mobile/package.json`:
- Remove scripts: `dev:ui`, `build:ui`, `eas-build-post-install`.
- Remove deps: `react-dom`, `superjson`.
- Remove devDeps: `@tailwindcss/postcss`, `@types/react-dom`, `@vitejs/plugin-react`, `vite`, `vite-plugin-singlefile`.
- KEEP `react-native-webview` (M7 editor island) — add nothing.

Run `npm install` at the repo root to refresh the lockfile.

`apps/mobile/tsconfig.json`: change `"include": ["**/*", "assets/ui/index.html"]` to `"include": ["**/*"]`.

- [ ] **Step 6: Update `apps/mobile/README.md`**

Replace any WebView-architecture description with a short note: the app is a native React Native UI over the shared `packages/client` data layer; the `window.colanode` contract is fulfilled in-process by `src/data/install-shim.ts`; the UI reuses `packages/ui` hooks (never its DOM components). Keep the experimental-status warning.

- [ ] **Step 7: Test, typecheck, bundle**

```bash
npm run test -w @colanode/mobile        # expected: 6 passed
npm run compile -w @colanode/mobile     # expected: exit 0
cd apps/mobile && npx expo export --platform ios --output-dir /tmp/expo-export-m1 && cd ../..
```

Expected: export succeeds WITHOUT `assets/ui/index.html` existing (delete `/tmp/expo-export-m1` afterwards). If export fails on the missing html asset, a stale reference survived — re-run the grep from Step 4.

- [ ] **Step 8: Commit**

```bash
git add -A apps/mobile package-lock.json
git commit -m "feat(mobile)!: replace WebView UI with native RN shell

Native root: AppService bootstrap -> window.colanode in-process shim ->
react-navigation tabs. Deletes the WebView app (src/ui), its vite build
pipeline and the superjson bridge types. packages/ui hooks are consumed
directly on Hermes."
```

---

### Task 8: Simulator verification (manual gate, no commit)

**Files:** none (verification only).

**Interfaces:**
- Consumes: everything above; the Mac build workflow.
- Produces: M1 exit evidence — screenshots of the tab bar and the Settings servers screen.

Build host is the Mac (`ssh mac`), clone at `~/workspace/colanode-build`. Key workflow facts (proven 2026-07-04): use a LOGIN shell for `expo run:ios` (CocoaPods on PATH), prelude `source ~/.nvm/nvm.sh && nvm use 24.15.0`, simulator device UDID `50B1BC35-75C8-406E-977B-6E731AE92636` (iPhone 16). NOTE: `npm run build:ui` is NO LONGER part of the flow — Task 7 removed it.

- [ ] **Step 1: Push the branch and check it out on the Mac**

```bash
git push -u origin <branch>
ssh mac 'bash -lc "cd ~/workspace/colanode-build && git fetch origin && git checkout <branch> && git pull && source ~/.nvm/nvm.sh && nvm use 24.15.0 && npm ci"'
```

- [ ] **Step 2: Build and launch in the simulator**

```bash
ssh mac 'bash -lc "source ~/.nvm/nvm.sh && nvm use 24.15.0 && cd ~/workspace/colanode-build/apps/mobile && npx expo run:ios --device 50B1BC35-75C8-406E-977B-6E731AE92636"'
```

(First cold launch after simulator boot can be flaky — relaunch once via `xcrun simctl terminate/launch booted com.bratmario.superchat` if Metro wasn't ready.)

- [ ] **Step 3: Verify the shell**

```bash
ssh mac 'xcrun simctl io booted screenshot /tmp/m1-tabbar.png'
scp mac:/tmp/m1-tabbar.png /tmp/
```

Checklist on the screenshot(s):
1. App boots past the loading indicator with NO WebView (no blank white flash of `index.html`).
2. Bottom tab bar shows Chats / Spaces / Inbox / Settings with icons.
3. Chats/Spaces/Inbox tabs render their "Coming soon" placeholders.
4. Settings tab shows the "SERVERS" header and either server rows (if the sim's SQLite has data from previous runs — it persists) or "No servers added yet".
5. Metro console shows no `query.result.updated`/hook errors and no duplicate-React crash (`Cannot read properties of null (reading 'useRef')`).

- [ ] **Step 4: Live-query smoke (only if a server exists in the sim's DB)**

While watching the Settings screen, toggle the server's availability (e.g. briefly stop the self-hosted server) and confirm the status dot updates without navigation — proving the eventBus → buildQueryClient → useLiveQuery loop works natively.

---

## Self-Review Notes

- Spec coverage (M1 bullet): native root ✓ (T7), shim ✓ (T3+T4), navigation skeleton ✓ (T5), provisional tokens ✓ (T2), Metro spike first ✓ (T1), proof screen with `server.list` via packages/ui hook ✓ (T6), simulator-runnable exit ✓ (T8).
- Deviation from spec noted in code comment: tabs-only navigation (no native-stack yet) — stacks land with the first inner screens in M2/M3; `@react-navigation/native-stack` is deliberately NOT installed in Task 1 (YAGNI, no dead dep).
- Type risk acknowledged: mediator generics in Task 3 Step 6 verify against `packages/client/src/handlers/mediator.ts`; push-state union in Task 4 verifies against `ColanodeWindowApi['push']`.
