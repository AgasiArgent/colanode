# Native Mobile M2 — Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full native auth: server picker/add → email login + register (+ OTP verification) → automatic entry into the workspace; workspace picker and account info + sign-out in Settings. App boots to auth when no account exists, to the main tabs otherwise.

**Architecture:** A `SessionGate` component replaces `RootNavigator` at the root: it live-queries `account.list` / `workspace.list` / `metadata.list` and renders either the `AuthNavigator` (native-stack: Servers → AddServer → Credentials → Verify) or `CurrentWorkspaceProvider` + main tabs. "Current workspace" is not local state — it is the `('app','workspace')` metadata row (same convention the web uses), so selection survives restarts and the gate re-renders reactively through the live `metadata.list` query. Login needs no manual navigation: the `email.login`/`email.register`/`email.verify` mutation handlers persist the account, start sync, and publish events; the gate's live queries flip the UI automatically.

**Tech Stack:** @react-navigation/native-stack (new dep), existing `packages/ui` hooks (`useLiveQuery`, `useMutation`), Mycel components built per the design project's `components/core/*.prompt.md` specs (Button, TextField, SegmentedControl).

**Spec:** `docs/superpowers/specs/2026-07-10-native-mobile-app-design.md` (milestone M2)

## Global Constraints

- Prerequisites: M1 + M1.5 landed (branch `worktree-design-briefs`).
- Monorepo installs from repo root with `-w @colanode/mobile`; expo commands inside `apps/mobile`.
- Gates per task: `npm run compile -w @colanode/mobile`, `npm run test -w @colanode/mobile`.
- All styling via theme modules (`useTheme` palette, `spacing`/`radius`, `fonts`/`typeScale`, `labelTracking`) — zero hardcoded colors/sizes.
- Mycel rules: primary button at most once per view; sentence case ("Sign in", not "SIGN IN"); uppercase+tracking only for mono section labels; errors are plain sentences; no emoji in chrome.
- Mutation errors are surfaced loudly: `Alert.alert('<what failed>', error.message)` — never swallowed.
- The auth mutations do all bootstrap work internally (persist account/workspaces, start socket + sync); the UI must NOT add manual init calls.
- Key data facts (verified against source): `email.login` input `{ type, server: <domain>, email, password }`; `email.register` adds `name`; `email.verify` input `{ type, server, id, otp }`; all three return `LoginOutput = { type:'success', account, workspaces: WorkspaceOutput[], ... } | { type:'verify', id, expiresAt }`; `WorkspaceOutput.user.id` is the workspace `userId`. `server.create` input `{ type, url }` — url must be the FULL config URL (e.g. `https://chat.kvotaflow.ru/config`); the handler validates with `new URL()`. `account.logout` input `{ type, accountId }`. `metadata.update` input `{ type, namespace, key, value: <JSON string> }`. Queries `account.list` / `workspace.list` / `metadata.list` take no fields; `Workspace = { userId, workspaceId, name, accountId, role, status, ... }`, `Account = { id, name, email, avatar?, server, ... }`, `Metadata = { namespace, key, value, ... }`.

---

### Task 1: native-stack dependency

**Files:**
- Modify: `apps/mobile/package.json` (+ lockfile)

**Interfaces:**
- Produces: `@react-navigation/native-stack@^7` for Tasks 3–5.

- [ ] **Step 1: Install** (react-native-screens is already pinned by M1)

```bash
npm install @react-navigation/native-stack@^7 -w @colanode/mobile
```

- [ ] **Step 2: Gate + commit**

```bash
npm run compile -w @colanode/mobile
git add apps/mobile/package.json package-lock.json
git commit -m "chore(mobile): add @react-navigation/native-stack for auth/settings stacks"
```

---

### Task 2: Mycel primitives — Button, TextField, SegmentedControl

**Files:**
- Create: `apps/mobile/src/components/button.tsx`
- Create: `apps/mobile/src/components/text-field.tsx`
- Create: `apps/mobile/src/components/segmented-control.tsx`

**Interfaces:**
- Consumes: theme modules (M1.5).
- Produces:
  - `Button({ label, onPress, variant?: 'primary'|'secondary'|'ghost'|'destructive', size?: 'md'|'sm', disabled?, loading?, testID?, style? })`
  - `TextField({ label?, error?, mono?, testID?, ...TextInputProps })`
  - `SegmentedControl({ options: { key: string; label: string }[], value: string, onChange(key), testID? })`
- Design contract: `components/core/Button.prompt.md` / `Input.prompt.md` in the Mycel project — variants primary (accent fill) / secondary (surface+border) / ghost (accent text) / destructive (danger fill); press = active color + scale(0.96); disabled = 40% opacity; input focus = accent border; error = danger border + message below. Hover states don't exist on touch — press replaces them.

- [ ] **Step 1: Button**

Create `apps/mobile/src/components/button.tsx`:

```tsx
import {
  ActivityIndicator,
  Pressable,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { type Palette } from '@colanode/mobile/theme/palette';
import { useTheme } from '@colanode/mobile/theme/theme-context';
import { radius, spacing } from '@colanode/mobile/theme/tokens';
import { fonts } from '@colanode/mobile/theme/typography';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type ButtonSize = 'md' | 'sm';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

const colorsFor = (
  palette: Palette,
  variant: ButtonVariant,
  pressed: boolean
) => {
  switch (variant) {
    case 'primary':
      return {
        bg: pressed ? palette.accentActive : palette.accent,
        fg: palette.accentForeground,
        border: 'transparent',
      };
    case 'secondary':
      return {
        bg: palette.surface,
        fg: palette.textPrimary,
        border: palette.border,
      };
    case 'ghost':
      return { bg: 'transparent', fg: palette.accent, border: 'transparent' };
    case 'destructive':
      return {
        bg: pressed ? palette.dangerActive : palette.danger,
        fg: palette.dangerForeground,
        border: 'transparent',
      };
  }
};

export const Button = ({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  testID,
  style,
}: ButtonProps) => {
  const { palette } = useTheme();

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => {
        const colors = colorsFor(palette, variant, pressed);
        return [
          {
            minHeight: size === 'md' ? 48 : 36,
            paddingHorizontal: size === 'md' ? spacing.lg : spacing.md,
            borderRadius: radius.md,
            backgroundColor: colors.bg,
            borderWidth: variant === 'secondary' ? 1 : 0,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: spacing.sm,
            opacity: disabled ? 0.4 : 1,
            transform: [{ scale: pressed && !disabled && !loading ? 0.96 : 1 }],
          },
          style,
        ];
      }}
    >
      {({ pressed }) => {
        const colors = colorsFor(palette, variant, pressed);
        return (
          <>
            {loading ? (
              <ActivityIndicator size="small" color={colors.fg} />
            ) : null}
            <Text
              style={{
                fontFamily: fonts.bodySemiBold,
                fontSize: size === 'md' ? 15 : 13,
                color: colors.fg,
              }}
            >
              {label}
            </Text>
          </>
        );
      }}
    </Pressable>
  );
};
```

- [ ] **Step 2: TextField**

Create `apps/mobile/src/components/text-field.tsx`:

```tsx
import { useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { type Palette } from '@colanode/mobile/theme/palette';
import { useTheme } from '@colanode/mobile/theme/theme-context';
import { radius, spacing } from '@colanode/mobile/theme/tokens';
import { fonts, typeScale } from '@colanode/mobile/theme/typography';

interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string;
  mono?: boolean;
}

const createStyles = (palette: Palette) =>
  StyleSheet.create({
    container: { gap: spacing.xs },
    label: {
      ...typeScale.caption,
      fontFamily: fonts.bodyMedium,
      color: palette.textSecondary,
    },
    input: {
      minHeight: 48,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      backgroundColor: palette.surface,
      color: palette.textPrimary,
      fontSize: 15,
    },
    error: { ...typeScale.caption, color: palette.danger },
  });

export const TextField = ({
  label,
  error,
  mono,
  style,
  onFocus,
  onBlur,
  ...inputProps
}: TextFieldProps) => {
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? palette.danger
    : focused
      ? palette.accent
      : palette.border;

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        {...inputProps}
        style={[
          styles.input,
          { borderColor, fontFamily: mono ? fonts.mono : fonts.body },
          style,
        ]}
        placeholderTextColor={palette.textFaint}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
};
```

- [ ] **Step 3: SegmentedControl**

Create `apps/mobile/src/components/segmented-control.tsx`:

```tsx
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { type Palette } from '@colanode/mobile/theme/palette';
import { useTheme } from '@colanode/mobile/theme/theme-context';
import { radius, spacing } from '@colanode/mobile/theme/tokens';
import { fonts } from '@colanode/mobile/theme/typography';

interface SegmentedControlProps {
  options: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
  testID?: string;
}

const createStyles = (palette: Palette) =>
  StyleSheet.create({
    track: {
      flexDirection: 'row',
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: radius.md,
      padding: 2,
      gap: 2,
    },
    segment: {
      flex: 1,
      minHeight: 40,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentActive: { backgroundColor: palette.accentSoft },
    label: { fontFamily: fonts.bodyMedium, fontSize: 14 },
  });

export const SegmentedControl = ({
  options,
  value,
  onChange,
  testID,
}: SegmentedControlProps) => {
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <View style={styles.track} testID={testID} accessibilityRole="tablist">
      {options.map((option) => {
        const active = option.key === value;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.segment, active && styles.segmentActive]}
            onPress={() => onChange(option.key)}
            testID={testID ? `${testID}-${option.key}` : undefined}
          >
            <Text
              style={[
                styles.label,
                {
                  color: active
                    ? palette.accentSoftForeground
                    : palette.textMuted,
                },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};
```

- [ ] **Step 4: Gate + commit**

```bash
npm run compile -w @colanode/mobile
git add apps/mobile/src/components
git commit -m "feat(mobile): Mycel primitives — Button, TextField, SegmentedControl"
```

---

### Task 3: Session core — workspace resolution (TDD), context, gate

**Files:**
- Create: `apps/mobile/src/session/resolve-workspace.ts`
- Test: `apps/mobile/src/session/resolve-workspace.test.ts`
- Create: `apps/mobile/src/session/current-workspace-context.tsx`
- Create: `apps/mobile/src/session/session-gate.tsx`
- Create: `apps/mobile/src/screens/auth/no-workspace-screen.tsx`
- Modify: `apps/mobile/src/app.tsx` (render `SessionGate` instead of `RootNavigator`)

**Interfaces:**
- Consumes: `useLiveQuery`/`useMutation` from `@colanode/ui/hooks/*`; types from `@colanode/client/types`; `AuthNavigator` (Task 4 — Tasks 3+4 are one compile-clean series, single commit at Task 4's end); `RootNavigator` (M1); `Button` (Task 2).
- Produces: `resolveDefaultUserId(workspaces: Workspace[], metadata: Metadata[]): string | undefined`; `useCurrentWorkspace(): { workspace: Workspace; account: Account; selectWorkspace(userId: string): void }`; `SessionGate` component.

- [ ] **Step 1: Write the failing tests**

Create `apps/mobile/src/session/resolve-workspace.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import type { Metadata, Workspace } from '@colanode/client/types';
import { resolveDefaultUserId } from './resolve-workspace';

const ws = (userId: string): Workspace =>
  ({ userId, workspaceId: `w-${userId}`, accountId: 'acc-1' }) as Workspace;
const meta = (value: string): Metadata =>
  ({ namespace: 'app', key: 'workspace', value }) as Metadata;

describe('resolveDefaultUserId', () => {
  it('returns the metadata-remembered userId when it still exists', () => {
    expect(
      resolveDefaultUserId([ws('u1'), ws('u2')], [meta(JSON.stringify('u2'))])
    ).toBe('u2');
  });

  it('falls back to the first workspace when the remembered id is stale', () => {
    expect(
      resolveDefaultUserId([ws('u1')], [meta(JSON.stringify('gone'))])
    ).toBe('u1');
  });

  it('survives malformed metadata json', () => {
    expect(resolveDefaultUserId([ws('u1')], [meta('{oops')])).toBe('u1');
  });

  it('returns undefined with no workspaces', () => {
    expect(resolveDefaultUserId([], [])).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run — verify FAIL** (`npm run test -w @colanode/mobile` → cannot resolve `./resolve-workspace`)

- [ ] **Step 3: Implement `resolve-workspace.ts`**

```ts
import type { Metadata, Workspace } from '@colanode/client/types';

// Mirrors packages/ui/src/routes/utils.tsx getDefaultWorkspaceUserId, but as a
// pure function over query results (the web reads TanStack DB collections).
// The ('app','workspace') metadata row stores the last-used userId as JSON.
export const resolveDefaultUserId = (
  workspaces: Workspace[],
  metadata: Metadata[]
): string | undefined => {
  const userIds = workspaces.map((workspace) => workspace.userId);
  const row = metadata.find(
    (item) => item.namespace === 'app' && item.key === 'workspace'
  );

  if (row) {
    try {
      const lastUsed = JSON.parse(row.value) as string;
      if (userIds.includes(lastUsed)) {
        return lastUsed;
      }
    } catch (error) {
      console.warn('[Mobile] malformed app.workspace metadata', row.value, error);
    }
  }

  return userIds[0];
};
```

- [ ] **Step 4: Run — verify PASS**

- [ ] **Step 5: Context**

Create `apps/mobile/src/session/current-workspace-context.tsx`:

```tsx
import { createContext, useContext } from 'react';

import type { Account, Workspace } from '@colanode/client/types';

export interface CurrentWorkspace {
  workspace: Workspace;
  account: Account;
  selectWorkspace: (userId: string) => void;
}

export const CurrentWorkspaceContext = createContext<CurrentWorkspace | null>(
  null
);

export const useCurrentWorkspace = (): CurrentWorkspace => {
  const context = useContext(CurrentWorkspaceContext);
  if (!context) {
    throw new Error('useCurrentWorkspace used outside SessionGate');
  }
  return context;
};
```

- [ ] **Step 6: No-workspace screen**

Create `apps/mobile/src/screens/auth/no-workspace-screen.tsx`:

```tsx
import { useMemo } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import type { Account } from '@colanode/client/types';
import { Button } from '@colanode/mobile/components/button';
import { type Palette } from '@colanode/mobile/theme/palette';
import { useTheme } from '@colanode/mobile/theme/theme-context';
import { spacing } from '@colanode/mobile/theme/tokens';
import { typeScale } from '@colanode/mobile/theme/typography';
import { useMutation } from '@colanode/ui/hooks/use-mutation';

const createStyles = (palette: Palette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
      padding: spacing.xl,
      backgroundColor: palette.background,
    },
    title: { ...typeScale.h2, color: palette.textPrimary, textAlign: 'center' },
    message: {
      ...typeScale.body,
      color: palette.textMuted,
      textAlign: 'center',
    },
  });

export const NoWorkspaceScreen = ({ account }: { account: Account }) => {
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const { isPending, mutate } = useMutation();

  return (
    <View style={styles.container} testID="no-workspace-screen">
      <Text style={styles.title}>No workspace yet</Text>
      <Text style={styles.message}>
        {account.email} has no workspaces. Create one on desktop or web, then
        come back — it will appear here automatically.
      </Text>
      <Button
        label="Sign out"
        variant="secondary"
        loading={isPending}
        testID="no-workspace-signout"
        onPress={() =>
          mutate({
            input: { type: 'account.logout', accountId: account.id },
            onError: (error) => Alert.alert('Sign out failed', error.message),
          })
        }
      />
    </View>
  );
};
```

- [ ] **Step 7: SessionGate**

Create `apps/mobile/src/session/session-gate.tsx`:

```tsx
import { useMemo } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import { AuthNavigator } from '@colanode/mobile/navigation/auth-navigator';
import { RootNavigator } from '@colanode/mobile/navigation/root-navigator';
import { NoWorkspaceScreen } from '@colanode/mobile/screens/auth/no-workspace-screen';
import {
  CurrentWorkspaceContext,
  type CurrentWorkspace,
} from '@colanode/mobile/session/current-workspace-context';
import { resolveDefaultUserId } from '@colanode/mobile/session/resolve-workspace';
import { useTheme } from '@colanode/mobile/theme/theme-context';
import { useLiveQuery } from '@colanode/ui/hooks/use-live-query';
import { useMutation } from '@colanode/ui/hooks/use-mutation';

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

export const SessionGate = () => {
  const { palette } = useTheme();
  const accountList = useLiveQuery({ type: 'account.list' });
  const workspaceList = useLiveQuery({ type: 'workspace.list' });
  const metadataList = useLiveQuery({ type: 'metadata.list' });
  const { mutate } = useMutation();

  const accounts = accountList.data ?? [];
  const workspaces = workspaceList.data ?? [];
  const metadata = metadataList.data ?? [];

  const session = useMemo((): CurrentWorkspace | null => {
    const userId = resolveDefaultUserId(workspaces, metadata);
    const workspace = workspaces.find((item) => item.userId === userId);
    if (!workspace) {
      return null;
    }
    const account = accounts.find((item) => item.id === workspace.accountId);
    if (!account) {
      return null;
    }

    const selectWorkspace = (nextUserId: string) => {
      const saveError = (error: { message: string }) =>
        Alert.alert('Could not switch workspace', error.message);
      mutate({
        input: {
          type: 'metadata.update',
          namespace: 'app',
          key: 'workspace',
          value: JSON.stringify(nextUserId),
        },
        onError: saveError,
      });
      const next = workspaces.find((item) => item.userId === nextUserId);
      if (next) {
        mutate({
          input: {
            type: 'metadata.update',
            namespace: next.accountId,
            key: 'workspace',
            value: JSON.stringify(nextUserId),
          },
          onError: saveError,
        });
      }
    };

    return { workspace, account, selectWorkspace };
  }, [accounts, workspaces, metadata, mutate]);

  if (
    accountList.isPending ||
    workspaceList.isPending ||
    metadataList.isPending
  ) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.accent} />
      </View>
    );
  }

  if (accounts.length === 0) {
    return <AuthNavigator />;
  }

  if (!session) {
    return <NoWorkspaceScreen account={accounts[0]!} />;
  }

  return (
    <CurrentWorkspaceContext.Provider value={session}>
      <RootNavigator />
    </CurrentWorkspaceContext.Provider>
  );
};
```

- [ ] **Step 8: Wire into `app.tsx`**

In `apps/mobile/src/app.tsx`: replace the `RootNavigator` import with `import { SessionGate } from '@colanode/mobile/session/session-gate';` and render `<SessionGate />` inside `NavigationContainer` where `<RootNavigator />` was.

- [ ] **Step 9: Proceed to Task 4** (compile red until `AuthNavigator` exists; tests must already pass).

---

### Task 4: Auth navigator + screens (Servers, AddServer, Credentials, Verify)

**Files:**
- Create: `apps/mobile/src/navigation/auth-navigator.tsx`
- Create: `apps/mobile/src/screens/auth/servers-screen.tsx`
- Create: `apps/mobile/src/screens/auth/server-add-screen.tsx`
- Create: `apps/mobile/src/screens/auth/credentials-screen.tsx`
- Create: `apps/mobile/src/screens/auth/verify-screen.tsx`

**Interfaces:**
- Consumes: Task 2 primitives; `useLiveQuery`/`useMutation`; theme; `LoginOutput` handling facts from Global Constraints.
- Produces: `AuthNavigator` (consumed by `SessionGate`) with param list:

```ts
export type AuthStackParamList = {
  Servers: undefined;
  ServerAdd: undefined;
  Credentials: { serverDomain: string; serverName: string };
  Verify: { serverDomain: string; verifyId: string; expiresAt: string };
};
```

- [ ] **Step 1: Navigator**

Create `apps/mobile/src/navigation/auth-navigator.tsx`:

```tsx
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { CredentialsScreen } from '@colanode/mobile/screens/auth/credentials-screen';
import { ServerAddScreen } from '@colanode/mobile/screens/auth/server-add-screen';
import { ServersScreen } from '@colanode/mobile/screens/auth/servers-screen';
import { VerifyScreen } from '@colanode/mobile/screens/auth/verify-screen';
import { useTheme } from '@colanode/mobile/theme/theme-context';
import { fonts, typeScale } from '@colanode/mobile/theme/typography';

export type AuthStackParamList = {
  Servers: undefined;
  ServerAdd: undefined;
  Credentials: { serverDomain: string; serverName: string };
  Verify: { serverDomain: string; verifyId: string; expiresAt: string };
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export const AuthNavigator = () => {
  const { palette } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: palette.surface },
        headerTitleStyle: {
          fontFamily: typeScale.h3.fontFamily,
          fontSize: typeScale.h3.fontSize,
          color: palette.textPrimary,
        },
        headerTintColor: palette.accent,
        headerBackButtonDisplayMode: 'minimal',
        headerShadowVisible: false,
        contentStyle: { backgroundColor: palette.background },
        headerBackTitleStyle: { fontFamily: fonts.body },
      }}
    >
      <Stack.Screen
        name="Servers"
        component={ServersScreen}
        options={{ title: 'Choose a server' }}
      />
      <Stack.Screen
        name="ServerAdd"
        component={ServerAddScreen}
        options={{ title: 'Add server' }}
      />
      <Stack.Screen
        name="Credentials"
        component={CredentialsScreen}
        options={({ route }) => ({ title: route.params.serverName })}
      />
      <Stack.Screen
        name="Verify"
        component={VerifyScreen}
        options={{ title: 'Check your email' }}
      />
    </Stack.Navigator>
  );
};
```

(If `headerBackButtonDisplayMode`/`headerBackTitleStyle` are not present in the installed native-stack version's types, drop those two lines — they are polish, not contract.)

- [ ] **Step 2: Servers screen** (brand entry: mono uppercase label + server list)

Create `apps/mobile/src/screens/auth/servers-screen.tsx`:

```tsx
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Server } from '@colanode/client/types';
import { Button } from '@colanode/mobile/components/button';
import { type AuthStackParamList } from '@colanode/mobile/navigation/auth-navigator';
import { type Palette } from '@colanode/mobile/theme/palette';
import { useTheme } from '@colanode/mobile/theme/theme-context';
import { radius, spacing } from '@colanode/mobile/theme/tokens';
import {
  fonts,
  labelTracking,
  typeScale,
} from '@colanode/mobile/theme/typography';
import { useLiveQuery } from '@colanode/ui/hooks/use-live-query';

const createStyles = (palette: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: palette.background },
    listContent: { padding: spacing.md, gap: spacing.sm },
    label: {
      fontFamily: fonts.monoSemiBold,
      fontSize: typeScale.caption.fontSize,
      letterSpacing: labelTracking,
      textTransform: 'uppercase',
      color: palette.textMuted,
      marginBottom: spacing.sm,
    },
    card: {
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: radius.lg,
      backgroundColor: palette.surface,
      padding: spacing.md,
      gap: spacing.xs,
    },
    name: {
      ...typeScale.body,
      fontFamily: fonts.bodyBold,
      color: palette.textPrimary,
    },
    domain: {
      ...typeScale.caption,
      fontFamily: fonts.mono,
      color: palette.textMuted,
    },
    footer: { padding: spacing.md, gap: spacing.sm },
    empty: { ...typeScale.body, color: palette.textMuted },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  });

type Props = NativeStackScreenProps<AuthStackParamList, 'Servers'>;

export const ServersScreen = ({ navigation }: Props) => {
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const serverList = useLiveQuery({ type: 'server.list' });

  if (serverList.isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.accent} />
      </View>
    );
  }

  const servers = serverList.data ?? [];

  return (
    <View style={styles.container}>
      <FlatList
        data={servers}
        testID="auth-server-list"
        keyExtractor={(server: Server) => server.domain}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <Text style={styles.label}>Connect to your server</Text>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            No servers yet. Add the one your team runs.
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            testID={`auth-server-${item.domain}`}
            accessibilityRole="button"
            style={styles.card}
            onPress={() =>
              navigation.navigate('Credentials', {
                serverDomain: item.domain,
                serverName: item.name,
              })
            }
          >
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.domain}>
              {item.domain} · v{item.version}
            </Text>
          </Pressable>
        )}
      />
      <View style={styles.footer}>
        <Button
          label="Add server"
          variant="secondary"
          testID="auth-server-add"
          onPress={() => navigation.navigate('ServerAdd')}
        />
      </View>
    </View>
  );
};
```

- [ ] **Step 3: Add-server screen**

Create `apps/mobile/src/screens/auth/server-add-screen.tsx`:

```tsx
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Button } from '@colanode/mobile/components/button';
import { TextField } from '@colanode/mobile/components/text-field';
import { type AuthStackParamList } from '@colanode/mobile/navigation/auth-navigator';
import { type Palette } from '@colanode/mobile/theme/palette';
import { useTheme } from '@colanode/mobile/theme/theme-context';
import { spacing } from '@colanode/mobile/theme/tokens';
import { typeScale } from '@colanode/mobile/theme/typography';
import { useMutation } from '@colanode/ui/hooks/use-mutation';

const createStyles = (palette: Palette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      padding: spacing.md,
      gap: spacing.md,
      backgroundColor: palette.background,
    },
    hint: { ...typeScale.caption, color: palette.textMuted },
  });

type Props = NativeStackScreenProps<AuthStackParamList, 'ServerAdd'>;

export const ServerAddScreen = ({ navigation }: Props) => {
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | undefined>();
  const { isPending, mutate } = useMutation();

  const submit = () => {
    const trimmed = url.trim();
    if (!/^https?:\/\/.+/.test(trimmed)) {
      setError('Enter the full config URL, starting with https://');
      return;
    }
    setError(undefined);
    mutate({
      input: { type: 'server.create', url: trimmed },
      onSuccess: () => navigation.goBack(),
      onError: (mutationError) =>
        Alert.alert('Could not add server', mutationError.message),
    });
  };

  return (
    <View style={styles.container}>
      <TextField
        label="Server config URL"
        mono
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        placeholder="https://your-server.dev/config"
        value={url}
        onChangeText={setUrl}
        error={error}
        testID="server-add-url"
      />
      <Text style={styles.hint}>
        The full /config URL of a self-hosted server — for example
        https://chat.example.com/config.
      </Text>
      <Button
        label="Add server"
        loading={isPending}
        onPress={submit}
        testID="server-add-submit"
      />
    </View>
  );
};
```

- [ ] **Step 4: Credentials screen (login/register in one, SegmentedControl)**

Create `apps/mobile/src/screens/auth/credentials-screen.tsx`:

```tsx
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';

import type { LoginOutput } from '@colanode/core';
import { Button } from '@colanode/mobile/components/button';
import { SegmentedControl } from '@colanode/mobile/components/segmented-control';
import { TextField } from '@colanode/mobile/components/text-field';
import { type AuthStackParamList } from '@colanode/mobile/navigation/auth-navigator';
import { rememberWorkspace } from '@colanode/mobile/session/remember-workspace';
import { type Palette } from '@colanode/mobile/theme/palette';
import { useTheme } from '@colanode/mobile/theme/theme-context';
import { spacing } from '@colanode/mobile/theme/tokens';
import { useMutation } from '@colanode/ui/hooks/use-mutation';

const createStyles = (palette: Palette) =>
  StyleSheet.create({
    content: {
      padding: spacing.md,
      gap: spacing.md,
      backgroundColor: palette.background,
      flexGrow: 1,
    },
  });

type Mode = 'login' | 'register';

type Props = NativeStackScreenProps<AuthStackParamList, 'Credentials'>;

export const CredentialsScreen = ({ navigation, route }: Props) => {
  const { serverDomain } = route.params;
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const { isPending, mutate } = useMutation();

  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (mode === 'register' && name.trim().length === 0) {
      next.name = 'Enter your name';
    }
    if (!email.includes('@')) {
      next.email = 'Enter a valid email';
    }
    if (password.length < 8) {
      next.password = 'At least 8 characters';
    }
    if (mode === 'register' && confirm !== password) {
      next.confirm = 'Passwords do not match';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleOutput = (output: LoginOutput) => {
    if (output.type === 'verify') {
      navigation.navigate('Verify', {
        serverDomain,
        verifyId: output.id,
        expiresAt: output.expiresAt,
      });
      return;
    }
    // Success: the mutation handler already persisted the account and started
    // sync; SessionGate flips to the main app via its live queries. We only
    // remember which workspace to open.
    rememberWorkspace(output);
  };

  const submit = () => {
    if (!validate()) {
      return;
    }
    if (mode === 'login') {
      mutate({
        input: { type: 'email.login', server: serverDomain, email, password },
        onSuccess: handleOutput,
        onError: (error) => Alert.alert('Sign in failed', error.message),
      });
    } else {
      mutate({
        input: {
          type: 'email.register',
          server: serverDomain,
          name: name.trim(),
          email,
          password,
        },
        onSuccess: handleOutput,
        onError: (error) => Alert.alert('Registration failed', error.message),
      });
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <SegmentedControl
        testID="auth-mode"
        value={mode}
        onChange={(key) => setMode(key as Mode)}
        options={[
          { key: 'login', label: 'Sign in' },
          { key: 'register', label: 'Create account' },
        ]}
      />
      {mode === 'register' ? (
        <TextField
          label="Name"
          value={name}
          onChangeText={setName}
          error={errors.name}
          testID="auth-name"
        />
      ) : null}
      <TextField
        label="Email"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        testID="auth-email"
      />
      <TextField
        label="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        testID="auth-password"
      />
      {mode === 'register' ? (
        <TextField
          label="Confirm password"
          secureTextEntry
          value={confirm}
          onChangeText={setConfirm}
          error={errors.confirm}
          testID="auth-confirm"
        />
      ) : null}
      <Button
        label={mode === 'login' ? 'Sign in' : 'Create account'}
        loading={isPending}
        onPress={submit}
        testID="auth-submit"
      />
    </ScrollView>
  );
};
```

Also create the tiny shared success helper `apps/mobile/src/session/remember-workspace.ts` (used by Credentials and Verify — DRY):

```ts
import type { LoginSuccessOutput } from '@colanode/core';

// Persist the freshly logged-in workspace as the app default so SessionGate
// opens it. Fire-and-forget: a failure only means the gate falls back to the
// first workspace, which for a fresh login is the same one.
export const rememberWorkspace = (output: LoginSuccessOutput) => {
  const userId = output.workspaces[0]?.user.id;
  if (!userId) {
    return;
  }
  window.colanode
    .executeMutation({
      type: 'metadata.update',
      namespace: 'app',
      key: 'workspace',
      value: JSON.stringify(userId),
    })
    .catch((error) =>
      console.warn('[Mobile] failed to remember workspace', error)
    );
};
```

(Type note: `handleOutput` narrows `output.type === 'verify'` first, so the `rememberWorkspace(output)` call receives the narrowed `LoginSuccessOutput`. If `LoginOutput`/`LoginSuccessOutput` are not exported from `@colanode/core`'s root, import from the actual module the source of truth uses — check `packages/core/src/types/auth.ts` export path.)

- [ ] **Step 5: Verify (OTP) screen**

Create `apps/mobile/src/screens/auth/verify-screen.tsx`:

```tsx
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import type { LoginOutput } from '@colanode/core';
import { Button } from '@colanode/mobile/components/button';
import { TextField } from '@colanode/mobile/components/text-field';
import { type AuthStackParamList } from '@colanode/mobile/navigation/auth-navigator';
import { rememberWorkspace } from '@colanode/mobile/session/remember-workspace';
import { type Palette } from '@colanode/mobile/theme/palette';
import { useTheme } from '@colanode/mobile/theme/theme-context';
import { spacing } from '@colanode/mobile/theme/tokens';
import { fonts, typeScale } from '@colanode/mobile/theme/typography';
import { useMutation } from '@colanode/ui/hooks/use-mutation';

const createStyles = (palette: Palette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      padding: spacing.md,
      gap: spacing.md,
      backgroundColor: palette.background,
    },
    message: { ...typeScale.body, color: palette.textSecondary },
    countdown: {
      ...typeScale.caption,
      fontFamily: fonts.mono,
      color: palette.textMuted,
    },
  });

type Props = NativeStackScreenProps<AuthStackParamList, 'Verify'>;

export const VerifyScreen = ({ route }: Props) => {
  const { serverDomain, verifyId, expiresAt } = route.params;
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const { isPending, mutate } = useMutation();
  const [otp, setOtp] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((current) => (current > 0 ? current - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const submit = () => {
    mutate({
      input: {
        type: 'email.verify',
        server: serverDomain,
        id: verifyId,
        otp: otp.trim(),
      },
      onSuccess: (output: LoginOutput) => {
        if (output.type === 'success') {
          rememberWorkspace(output);
        }
      },
      onError: (error) => Alert.alert('Verification failed', error.message),
    });
  };

  return (
    <View style={styles.container} testID="auth-verify-screen">
      <Text style={styles.message}>
        We sent a code to your email. Enter it below to finish signing in.
      </Text>
      <TextField
        label="Verification code"
        mono
        keyboardType="number-pad"
        autoCapitalize="none"
        value={otp}
        onChangeText={setOtp}
        testID="auth-otp"
      />
      <Text style={styles.countdown}>
        {secondsLeft > 0
          ? `code expires in ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`
          : 'code expired — go back and sign in again'}
      </Text>
      <Button
        label="Verify"
        loading={isPending}
        disabled={otp.trim().length === 0 || secondsLeft === 0}
        onPress={submit}
        testID="auth-verify-submit"
      />
    </View>
  );
};
```

- [ ] **Step 6: Gates + commit (Tasks 3+4)**

```bash
npm run test -w @colanode/mobile      # resolve-workspace + palette + factory tests pass
npm run compile -w @colanode/mobile   # exit 0
git add apps/mobile/src
git commit -m "feat(mobile): native auth — session gate, server picker, login/register/verify"
```

---

### Task 5: Settings — account info, workspace picker, sign out

**Files:**
- Create: `apps/mobile/src/navigation/settings-navigator.tsx`
- Modify: `apps/mobile/src/navigation/root-navigator.tsx` (Settings tab renders the stack)
- Modify: `apps/mobile/src/screens/settings/settings-screen.tsx` (account/workspace/sign-out sections)
- Create: `apps/mobile/src/screens/settings/workspace-picker-screen.tsx`

**Interfaces:**
- Consumes: `useCurrentWorkspace` (Task 3), primitives (Task 2), existing servers list UI.
- Produces: `SettingsNavigator` with `SettingsStackParamList = { SettingsHome: undefined; WorkspacePicker: undefined }`.

- [ ] **Step 1: Settings stack**

Create `apps/mobile/src/navigation/settings-navigator.tsx`:

```tsx
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { SettingsScreen } from '@colanode/mobile/screens/settings/settings-screen';
import { WorkspacePickerScreen } from '@colanode/mobile/screens/settings/workspace-picker-screen';
import { useTheme } from '@colanode/mobile/theme/theme-context';
import { typeScale } from '@colanode/mobile/theme/typography';

export type SettingsStackParamList = {
  SettingsHome: undefined;
  WorkspacePicker: undefined;
};

const Stack = createNativeStackNavigator<SettingsStackParamList>();

export const SettingsNavigator = () => {
  const { palette } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: palette.surface },
        headerTitleStyle: {
          fontFamily: typeScale.h3.fontFamily,
          fontSize: typeScale.h3.fontSize,
          color: palette.textPrimary,
        },
        headerTintColor: palette.accent,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: palette.background },
      }}
    >
      <Stack.Screen
        name="SettingsHome"
        component={SettingsScreen}
        options={{ title: 'Settings' }}
      />
      <Stack.Screen
        name="WorkspacePicker"
        component={WorkspacePickerScreen}
        options={{ title: 'Workspace' }}
      />
    </Stack.Navigator>
  );
};
```

In `root-navigator.tsx`: import `SettingsNavigator`, change the Settings tab to `component={SettingsNavigator}` and add `options={{ headerShown: false }}` for that tab (the stack owns its header now; other tabs keep theirs).

- [ ] **Step 2: Rework SettingsScreen**

Rewrite `apps/mobile/src/screens/settings/settings-screen.tsx` as a `ScrollView` with sections (keep the existing servers list code as the SERVERS section; keep existing `createStyles` entries used by it, add new ones):

```tsx
// New/changed pieces only — full file assembles: ACCOUNT section, WORKSPACE
// section, SERVERS section (existing FlatList content becomes a mapped list
// inside the ScrollView), SIGN OUT section.
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import { Alert, ScrollView } from 'react-native';

import { Button } from '@colanode/mobile/components/button';
import { type SettingsStackParamList } from '@colanode/mobile/navigation/settings-navigator';
import { useCurrentWorkspace } from '@colanode/mobile/session/current-workspace-context';
import { useMutation } from '@colanode/ui/hooks/use-mutation';

type Props = NativeStackScreenProps<SettingsStackParamList, 'SettingsHome'>;

export const SettingsScreen = ({ navigation }: Props) => {
  const { workspace, account } = useCurrentWorkspace();
  const { isPending, mutate } = useMutation();
  // ... theme/styles as before ...

  return (
    <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: spacing.xl }}>
      <Text style={styles.header}>Account</Text>
      <View style={styles.row} testID="settings-account">
        <View style={styles.avatar}>
          <Text style={styles.avatarInitial}>
            {account.name.trim().charAt(0).toUpperCase() || '?'}
          </Text>
        </View>
        <View style={styles.rowText}>
          <Text style={styles.name}>{account.name}</Text>
          <Text style={styles.domain}>{account.email}</Text>
        </View>
      </View>

      <Text style={styles.header}>Workspace</Text>
      <Pressable
        style={styles.row}
        testID="settings-workspace"
        accessibilityRole="button"
        onPress={() => navigation.navigate('WorkspacePicker')}
      >
        <View style={styles.rowText}>
          <Text style={styles.name}>{workspace.name}</Text>
          <Text style={styles.domain}>{workspace.role}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={palette.textFaint} />
      </Pressable>

      <Text style={styles.header}>Servers</Text>
      {/* existing server rows, rendered via servers.map(...) with the existing
          ServerRow component; loading/error/empty states preserved */}

      <View style={{ padding: spacing.md }}>
        <Button
          label="Sign out"
          variant="destructive"
          loading={isPending}
          testID="settings-signout"
          onPress={() =>
            Alert.alert('Sign out?', 'Local data for this account is removed from this device.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Sign out',
                style: 'destructive',
                onPress: () =>
                  mutate({
                    input: { type: 'account.logout', accountId: account.id },
                    onError: (error) => Alert.alert('Sign out failed', error.message),
                  }),
              },
            ])
          }
        />
      </View>
    </ScrollView>
  );
};
```

New style entries: `avatar` (36×36, `borderRadius: radius.full`, `backgroundColor: palette.accentSoft`, centered) and `avatarInitial` (`fontFamily: fonts.bodyBold`, color `palette.accentSoftForeground`). After logout succeeds, `SessionGate`'s live queries render the auth flow automatically — no navigation code.

- [ ] **Step 3: Workspace picker**

Create `apps/mobile/src/screens/settings/workspace-picker-screen.tsx`:

```tsx
import { Ionicons } from '@expo/vector-icons';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { type SettingsStackParamList } from '@colanode/mobile/navigation/settings-navigator';
import { useCurrentWorkspace } from '@colanode/mobile/session/current-workspace-context';
import { type Palette } from '@colanode/mobile/theme/palette';
import { useTheme } from '@colanode/mobile/theme/theme-context';
import { spacing } from '@colanode/mobile/theme/tokens';
import { fonts, typeScale } from '@colanode/mobile/theme/typography';
import { useLiveQuery } from '@colanode/ui/hooks/use-live-query';

const createStyles = (palette: Palette) =>
  StyleSheet.create({
    list: { flex: 1, backgroundColor: palette.background },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: palette.border,
      gap: spacing.md,
    },
    rowText: { flex: 1, gap: spacing.xs },
    name: {
      ...typeScale.body,
      fontFamily: fonts.bodyBold,
      color: palette.textPrimary,
    },
    role: { ...typeScale.caption, color: palette.textMuted },
  });

type Props = NativeStackScreenProps<SettingsStackParamList, 'WorkspacePicker'>;

export const WorkspacePickerScreen = ({ navigation }: Props) => {
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const { workspace, account, selectWorkspace } = useCurrentWorkspace();
  const workspaceList = useLiveQuery({ type: 'workspace.list' });

  const workspaces = (workspaceList.data ?? []).filter(
    (item) => item.accountId === account.id
  );

  return (
    <FlatList
      style={styles.list}
      data={workspaces}
      testID="workspace-picker-list"
      keyExtractor={(item) => item.userId}
      renderItem={({ item }) => (
        <Pressable
          style={styles.row}
          accessibilityRole="button"
          testID={`workspace-${item.workspaceId}`}
          onPress={() => {
            selectWorkspace(item.userId);
            navigation.goBack();
          }}
        >
          <View style={styles.rowText}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.role}>{item.role}</Text>
          </View>
          {item.userId === workspace.userId ? (
            <Ionicons name="checkmark" size={18} color={palette.accent} />
          ) : null}
        </Pressable>
      )}
    />
  );
};
```

- [ ] **Step 4: Gates + commit**

```bash
npm run test -w @colanode/mobile
npm run compile -w @colanode/mobile
cd apps/mobile && npx expo export --platform ios --output-dir /tmp/expo-export-m2 && cd ../..
git add apps/mobile/src
git commit -m "feat(mobile): settings account section, workspace picker, sign out"
```

---

### Task 6: Simulator verification (manual gate, no commit)

**Files:** none.

Same Mac workflow as M1.5 (login shell, nvm 24.15.0, device UDID `50B1BC35-75C8-406E-977B-6E731AE92636`). Remember: after any `app.json` change run `npx expo prebuild -p ios --no-install` (none expected in M2 — plain rebuild is fine).

- [ ] **Step 1: Push, pull on Mac, rebuild, launch** (as M1.5 Task 5 Step 1).

- [ ] **Step 2: Boot gating with persisted account.** The sim's SQLite persists across installs — if an account exists from earlier sessions, the app must boot straight to the tabs. Screenshot Settings: ACCOUNT section shows name+email, WORKSPACE section shows the workspace + role, SERVERS section intact.

- [ ] **Step 3: Workspace picker.** Open Settings → Workspace → picker lists workspaces with a checkmark on the current one; tapping another (if any) returns and updates the Settings row.

- [ ] **Step 4: Sign out → auth flow.** Settings → Sign out → confirm. Expected WITHOUT any navigation code: the gate flips to "Choose a server" with the mono "CONNECT TO YOUR SERVER" label and the persisted server card(s). Screenshot.

- [ ] **Step 5: Add-server validation.** "Add server" → enter `not-a-url` → inline error; enter a full valid config URL (e.g. `https://chat.kvotaflow.ru/config`) → card appears in the list (live query). Screenshot.

- [ ] **Step 6: Login round-trip.** Tap the server card → Credentials screen (segmented Sign in / Create account, themed inputs). Sign in with valid credentials for the test server if available; on success the app must land on the tabs with the workspace loaded (no manual navigation). If the flow returns the OTP screen, complete it if the code is accessible; otherwise verify the Verify screen renders (countdown ticking) and report the round-trip as blocked-by-credentials (environmental), NOT as failure. Alternatively use "Create account" with a throwaway email if the server allows open registration.

- [ ] **Step 7: Report** — screenshots of: Settings with account, auth Servers screen, Credentials screen, and (if reached) post-login tabs. Both themes not required here (M1.5 covered theming); dark only is fine.

---

## Self-Review Notes

- Spec coverage (M2 bullet): server picker/add ✓ (T4), email login+register ✓ (T4, + OTP verify which the LoginOutput contract requires), workspace picker ✓ (T5), Settings account info + logout ✓ (T5), boot gating ✓ (T3). Workspace creation is out of scope per spec — `NoWorkspaceScreen` covers the empty case.
- The gate relies on `account.list`/`workspace.list`/`metadata.list` live queries reacting to `account.created`/`workspace.created`/`metadata.updated` events — this is the same reactivity path the web collections use; the simulator gate (T6 Step 4/6) explicitly exercises both directions (login-in, logout-out).
- Type-risk callouts for the implementer: `LoginOutput`/`LoginSuccessOutput` export path from `@colanode/core` (check `packages/core/src/types/auth.ts` and the package's export map); native-stack `screenOptions` fields vary by minor version (two optional lines marked droppable). Verify `metadata.update`'s exact input field names against `packages/client/src/mutations/metadata/` before writing.
- Tasks 3+4 are a single compile-clean series (gate imports AuthNavigator) — one commit; Task 5 is independent after Task 3 (uses only the context) but sequenced after 4 for a always-green branch.
