# Native Mobile M1.5 — Mycel Design Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the provisional M1 tokens with the Mycel design system — dual-theme palette (dark primary), brand typography (Bricolage Grotesque / Karla / Spline Sans Mono), themed navigation — and migrate every M1 screen onto it, so all M2+ screens are built in the final visual language.

**Architecture:** Theme foundations live in `apps/mobile/src/theme/`: `palette.ts` (light+dark ramps, typed), `typography.ts` (font families + type scale), `tokens.ts` (spacing/radius/motion constants), `theme-context.tsx` (`ThemeProvider`/`useTheme` over RN `useColorScheme`, dark-first). Components never hardcode values; static `StyleSheet.create` becomes a `createStyles(palette)` factory memoized per theme.

**Tech Stack:** expo-font + @expo-google-fonts (static weights), react-navigation v7 theming, vitest for palette parity.

**Spec:** `docs/superpowers/specs/2026-07-10-native-mobile-app-design.md` (milestone M1.5)
**Design source of truth:** claude.ai/design project `b08894a6-0794-47ed-9bee-5a3f8934be84` ("Workspace brand concepts") — `tokens/colors.css`, `tokens/typography.css`, `tokens/spacing.css`, `tokens/motion.css`, `readme.md`. Values below are copied verbatim from those files.

## Global Constraints

- Prerequisite: the M1 plan (`2026-07-10-native-mobile-m1-shell.md`) is fully landed.
- Dark is the PRIMARY theme: unknown/null color scheme resolves to dark.
- Both themes are first-class — every task's verification covers light AND dark.
- No gradients, no glassmorphism, nothing sharp: radii come only from `radius` tokens (min 8px).
- Fonts: display/headings = Bricolage Grotesque (700/800), body/UI = Karla, semantic mono (timestamps, sync, `#`, system labels) = Spline Sans Mono. Sentence case everywhere; mono labels may be UPPERCASE with 1.2px tracking.
- Emoji never appear in UI chrome or system copy.
- Accent (`#57D9A3` dark / `#177A55` light) is never used as body-copy color on plain background; accent fills always pair with `accentForeground`.
- Monorepo installs: `npm install <pkg> -w @colanode/mobile` from the repo root; `npx expo install` inside `apps/mobile`.
- Gates per task: `npm run compile -w @colanode/mobile`, `npm run test -w @colanode/mobile`.

---

### Task 1: Font dependencies

**Files:**
- Modify: `apps/mobile/package.json` (+ lockfile)

**Interfaces:**
- Consumes: nothing.
- Produces: loadable static font modules `BricolageGrotesque_700Bold`, `BricolageGrotesque_800ExtraBold`, `Karla_400Regular`, `Karla_500Medium`, `Karla_600SemiBold`, `Karla_700Bold`, `SplineSansMono_400Regular`, `SplineSansMono_500Medium`, `SplineSansMono_600SemiBold` — consumed by Tasks 2/3.

- [ ] **Step 1: Install**

```bash
cd apps/mobile && npx expo install expo-font && cd ../..
npm install @expo-google-fonts/bricolage-grotesque @expo-google-fonts/karla @expo-google-fonts/spline-sans-mono -w @colanode/mobile
```

**Contingency (only if an @expo-google-fonts package does not exist for a family):** download the OFL `.ttf` statics for the missing weights from Google Fonts into `apps/mobile/assets/fonts/` and load them in Task 3 via `useFonts({ 'BricolageGrotesque_700Bold': require('../assets/fonts/BricolageGrotesque-Bold.ttf'), ... })` — keep the SAME font-family key names so `typography.ts` is unaffected.

- [ ] **Step 2: Verify resolvable**

```bash
node -e "for (const p of ['@expo-google-fonts/bricolage-grotesque','@expo-google-fonts/karla','@expo-google-fonts/spline-sans-mono']) require.resolve(p); console.log('ok')"
```

Expected: `ok`.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/package.json package-lock.json
git commit -m "chore(mobile): add Mycel font packages (Bricolage Grotesque, Karla, Spline Sans Mono)"
```

---

### Task 2: Theme foundation (palette, typography, tokens, context) + parity test

**Files:**
- Create: `apps/mobile/src/theme/palette.ts`
- Create: `apps/mobile/src/theme/typography.ts`
- Create: `apps/mobile/src/theme/theme-context.tsx`
- Rewrite: `apps/mobile/src/theme/tokens.ts`
- Test: `apps/mobile/src/theme/palette.test.ts`

**Interfaces:**
- Consumes: font family names (Task 1).
- Produces: `Palette` type + `lightPalette`/`darkPalette`; `fonts`, `typeScale`, `labelTracking`; `spacing`, `radius`, `motion`; `ThemeProvider`, `useTheme(): { palette: Palette; isDark: boolean }`. Tasks 3–4 and ALL future milestones consume exactly these.

- [ ] **Step 1: Write the failing parity test**

Create `apps/mobile/src/theme/palette.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { darkPalette, lightPalette } from './palette';

describe('mycel palettes', () => {
  it('light and dark expose identical token sets', () => {
    expect(Object.keys(darkPalette).sort()).toEqual(
      Object.keys(lightPalette).sort()
    );
  });

  it('dark is the biolum ramp (spot-check brand anchors)', () => {
    expect(darkPalette.accent).toBe('#57D9A3');
    expect(lightPalette.accent).toBe('#177A55');
    expect(darkPalette.background).toBe('#0B120F');
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npm run test -w @colanode/mobile`
Expected: FAIL — cannot resolve `./palette`.

- [ ] **Step 3: Create `palette.ts`**

Values copied verbatim from the design project's `tokens/colors.css` (hover-only tokens omitted — no hover on touch):

```ts
// Mycel color tokens — source of truth: claude.ai/design project
// "Workspace brand concepts", tokens/colors.css. Dark is the PRIMARY theme.
export interface Palette {
  background: string;
  surface: string;
  surfaceElevated: string;
  sidebar: string;
  rail: string;
  border: string;
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textFaint: string;
  accent: string;
  accentActive: string;
  accentForeground: string;
  accentSoft: string;
  accentSoftForeground: string;
  spore: string;
  sporeSoft: string;
  sporeSoftForeground: string;
  success: string;
  successSoft: string;
  successSoftForeground: string;
  warning: string;
  danger: string;
  dangerActive: string;
  dangerForeground: string;
  bubbleOwn: string;
  bubbleOwnForeground: string;
  bubbleOther: string;
  bubbleOtherForeground: string;
  bubbleOtherBorder: string;
  focusRing: string;
}

export const lightPalette: Palette = {
  background: '#F2F1EA',
  surface: '#FBFAF5',
  surfaceElevated: '#FFFFFF',
  sidebar: '#EDECE3',
  rail: '#E7E5DC',
  border: '#E0DED4',
  borderStrong: '#B9C4BC',
  textPrimary: '#1C2420',
  textSecondary: '#3A463F',
  textMuted: '#5C6B62',
  textFaint: '#8A968E',
  accent: '#177A55',
  accentActive: '#115C40',
  accentForeground: '#FBFAF5',
  accentSoft: '#DDEBE1',
  accentSoftForeground: '#14352A',
  spore: '#A96B1B',
  sporeSoft: '#EFE0C6',
  sporeSoftForeground: '#5A431E',
  success: '#1E7A3E',
  successSoft: '#CFE4D6',
  successSoftForeground: '#14532E',
  warning: '#A96B1B',
  danger: '#B94A38',
  dangerActive: '#93382A',
  dangerForeground: '#FBFAF5',
  bubbleOwn: '#E2EDE2',
  bubbleOwnForeground: '#1C2420',
  bubbleOther: '#FBFAF5',
  bubbleOtherForeground: '#1C2420',
  bubbleOtherBorder: '#E0DED4',
  focusRing: 'rgba(23, 122, 85, 0.15)',
};

export const darkPalette: Palette = {
  background: '#0B120F',
  surface: '#121B16',
  surfaceElevated: '#1A2721',
  sidebar: '#0E1512',
  rail: '#080D0B',
  border: '#1E2C25',
  borderStrong: '#2E5A46',
  textPrimary: '#E6EFE9',
  textSecondary: '#C8D6CD',
  textMuted: '#8FA69A',
  textFaint: '#5F7268',
  accent: '#57D9A3',
  accentActive: '#3FBF8A',
  accentForeground: '#0B120F',
  accentSoft: '#1E3B2F',
  accentSoftForeground: '#A8EACB',
  spore: '#D9A05B',
  sporeSoft: '#2E2A1A',
  sporeSoftForeground: '#E4D3B9',
  success: '#6FD98F',
  successSoft: '#1E3B2F',
  successSoftForeground: '#A8EACB',
  warning: '#D9A05B',
  danger: '#E07A6B',
  dangerActive: '#C4604F',
  dangerForeground: '#0B120F',
  bubbleOwn: '#1E3B2F',
  bubbleOwnForeground: '#E6EFE9',
  bubbleOther: '#121B16',
  bubbleOtherForeground: '#C8D6CD',
  bubbleOtherBorder: 'transparent',
  focusRing: 'rgba(87, 217, 163, 0.15)',
};
```

- [ ] **Step 4: Run test — verify it passes**

Run: `npm run test -w @colanode/mobile`
Expected: parity + anchor tests pass (plus the 6 M1 factory tests).

- [ ] **Step 5: Create `typography.ts`**

```ts
// Mycel type — source of truth: tokens/typography.css.
// Static font-family names must match the keys loaded via useFonts (app.tsx).
export const fonts = {
  display: 'BricolageGrotesque_800ExtraBold',
  heading: 'BricolageGrotesque_700Bold',
  body: 'Karla_400Regular',
  bodyMedium: 'Karla_500Medium',
  bodySemiBold: 'Karla_600SemiBold',
  bodyBold: 'Karla_700Bold',
  mono: 'SplineSansMono_400Regular',
  monoMedium: 'SplineSansMono_500Medium',
  monoSemiBold: 'SplineSansMono_600SemiBold',
} as const;

export interface TypeStyle {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing?: number;
}

export const typeScale: Record<
  'display' | 'h1' | 'h2' | 'h3' | 'body' | 'caption' | 'code',
  TypeStyle
> = {
  display: { fontFamily: fonts.display, fontSize: 40, lineHeight: 44, letterSpacing: -0.5 },
  h1: { fontFamily: fonts.heading, fontSize: 28, lineHeight: 34 },
  h2: { fontFamily: fonts.heading, fontSize: 22, lineHeight: 28 },
  h3: { fontFamily: fonts.heading, fontSize: 17, lineHeight: 24 },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21 },
  caption: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17 },
  code: { fontFamily: fonts.mono, fontSize: 11, lineHeight: 16 },
};

// Uppercase mono section labels ("SERVERS", "CONNECT TO YOUR SERVER").
export const labelTracking = 1.2;
```

- [ ] **Step 6: Rewrite `tokens.ts`**

Replace the entire provisional file with:

```ts
// Mycel layout constants — source of truth: tokens/spacing.css + motion.css.
// Colors live in palette.ts (theme-dependent), type in typography.ts.
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

// Organic radii — Mycel is soft, never sharp.
export const radius = {
  sm: 8,
  md: 12, // buttons, inputs, chips
  lg: 16, // cards, composer
  xl: 20, // modals
  full: 999,
  bubble: 16,
  bubbleAnchor: 4, // bubble corner pointing at the avatar
} as const;

// Surfaces GROW (scale .98 -> 1 + fade), never slide.
export const motion = {
  microDurationMs: 120,
  panelDurationMs: 240,
  sporePeriodMs: 2600, // breathing pulse while writing locally
  sporeRippleMs: 600, // single ripple on peer acknowledgement
} as const;
```

(This deletes the old `tokens` export — Task 4 migrates its consumers; `npm run compile` stays red until Task 4, which is why Tasks 2–4 land as one commit series in the same session, compile-gated at Task 4.)

- [ ] **Step 7: Create `theme-context.tsx`**

```tsx
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import {
  darkPalette,
  lightPalette,
  type Palette,
} from '@colanode/mobile/theme/palette';

interface Theme {
  palette: Palette;
  isDark: boolean;
}

// Mycel: dark is the primary theme — unknown/null schemes resolve to dark.
const ThemeContext = createContext<Theme>({ palette: darkPalette, isDark: true });

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const scheme = useColorScheme();
  const isDark = scheme !== 'light';

  const value = useMemo(
    () => ({ palette: isDark ? darkPalette : lightPalette, isDark }),
    [isDark]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
```

- [ ] **Step 8: Run tests (compile gate deferred to Task 4)**

Run: `npm run test -w @colanode/mobile`
Expected: all pass. Do NOT commit yet — Tasks 2–4 form one compile-clean series; commit happens at Task 4 Step 5.

---

### Task 3: App integration — fonts gate, ThemeProvider, themed navigation shell

**Files:**
- Modify: `apps/mobile/src/app.tsx`
- Create: `apps/mobile/src/theme/navigation-theme.ts`
- Modify: `apps/mobile/app.json`

**Interfaces:**
- Consumes: Task 2 exports; font modules (Task 1); `RootNavigator` (M1).
- Produces: `buildNavigationTheme(palette, isDark): NavigationTheme`; the app renders inside `ThemeProvider` with fonts loaded before first paint.

- [ ] **Step 1: Create `navigation-theme.ts`**

```ts
import type { Theme as NavigationTheme } from '@react-navigation/native';

import type { Palette } from '@colanode/mobile/theme/palette';
import { fonts } from '@colanode/mobile/theme/typography';

export const buildNavigationTheme = (
  palette: Palette,
  isDark: boolean
): NavigationTheme => ({
  dark: isDark,
  colors: {
    primary: palette.accent,
    background: palette.background,
    card: palette.surface,
    text: palette.textPrimary,
    border: palette.border,
    notification: palette.spore,
  },
  fonts: {
    regular: { fontFamily: fonts.body, fontWeight: '400' },
    medium: { fontFamily: fonts.bodyMedium, fontWeight: '500' },
    bold: { fontFamily: fonts.bodyBold, fontWeight: '700' },
    heavy: { fontFamily: fonts.heading, fontWeight: '700' },
  },
});
```

- [ ] **Step 2: Restructure `app.tsx`**

Changes (keep everything not mentioned — bootstrap logic, ErrorUtils handler, MobileErrorBoundary):

1. New imports:

```tsx
import {
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import {
  Karla_400Regular,
  Karla_500Medium,
  Karla_600SemiBold,
  Karla_700Bold,
} from '@expo-google-fonts/karla';
import {
  SplineSansMono_400Regular,
  SplineSansMono_500Medium,
  SplineSansMono_600SemiBold,
} from '@expo-google-fonts/spline-sans-mono';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';

import { buildNavigationTheme } from '@colanode/mobile/theme/navigation-theme';
import { type Palette } from '@colanode/mobile/theme/palette';
import { ThemeProvider, useTheme } from '@colanode/mobile/theme/theme-context';
import { radius, spacing } from '@colanode/mobile/theme/tokens';
import { typeScale } from '@colanode/mobile/theme/typography';
```

Remove the `tokens` import.

2. Replace the static `styles` with a factory (used via `useMemo` inside components):

```tsx
const createStyles = (palette: Palette) =>
  StyleSheet.create({
    loading: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.background,
    },
    errorContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      padding: spacing.lg,
      backgroundColor: palette.background,
    },
    errorTitle: {
      ...typeScale.h2,
      color: palette.textPrimary,
      textAlign: 'center',
    },
    errorMessage: {
      ...typeScale.body,
      color: palette.textSecondary,
      textAlign: 'center',
    },
    errorRetryButton: {
      marginTop: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      borderRadius: radius.md,
      backgroundColor: palette.accent,
      minHeight: 48,
      minWidth: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    errorRetryText: {
      ...typeScale.body,
      fontFamily: typeScale.body.fontFamily,
      fontWeight: '700',
      color: palette.accentForeground,
    },
  });
```

`MobileErrorState` becomes theme-aware (it is a function component — `useTheme()` + `useMemo(() => createStyles(palette), [palette])` inside). `MobileErrorBoundary` (class) renders `MobileErrorState`, so it needs no theme access itself.

3. Split the root: `App` = provider shell; the old body moves to `AppBootstrap`:

```tsx
export const App = () => (
  <ThemeProvider>
    <AppBootstrap />
  </ThemeProvider>
);

const AppBootstrap = () => {
  const { palette, isDark } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    Karla_400Regular,
    Karla_500Medium,
    Karla_600SemiBold,
    Karla_700Bold,
    SplineSansMono_400Regular,
    SplineSansMono_500Medium,
    SplineSansMono_600SemiBold,
  });

  // ... existing app/pushService refs, boot state, initialize callback ...

  if (!fontsLoaded || boot.phase === 'initializing') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator testID="app-loading-indicator" color={palette.accent} />
      </View>
    );
  }

  // ... error branch unchanged ...

  return (
    <SafeAreaProvider>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <MobileErrorBoundary>
        <QueryClientProvider client={boot.queryClient}>
          <NavigationContainer theme={buildNavigationTheme(palette, isDark)}>
            <RootNavigator />
          </NavigationContainer>
        </QueryClientProvider>
      </MobileErrorBoundary>
    </SafeAreaProvider>
  );
};
```

- [ ] **Step 3: app.json — enable dark**

In `apps/mobile/app.json` change `"userInterfaceStyle": "light"` to `"userInterfaceStyle": "automatic"`. (Splash stays light-background for now — acceptable; a dark splash variant is a follow-up with the app-icon rebrand.)

- [ ] **Step 4: Proceed to Task 4** (compile still red until consumers migrate).

---

### Task 4: Migrate M1 screens and navigator off provisional tokens

**Files:**
- Modify: `apps/mobile/src/navigation/root-navigator.tsx`
- Modify: `apps/mobile/src/components/placeholder-screen.tsx`
- Modify: `apps/mobile/src/screens/settings/settings-screen.tsx`

**Interfaces:**
- Consumes: `useTheme`, `spacing`/`radius`, `fonts`/`typeScale`/`labelTracking`.
- Produces: nothing new — visual migration only; screen/component export names unchanged.

- [ ] **Step 1: Root navigator — Mycel chrome**

In `root-navigator.tsx`: import `useTheme`, `fonts`, `typeScale`; delete the `tokens` import. `RootNavigator` reads `const { palette } = useTheme();` and the `screenOptions` become:

```tsx
    screenOptions={({ route }) => ({
      tabBarActiveTintColor: palette.accent,
      tabBarInactiveTintColor: palette.textMuted,
      tabBarStyle: {
        backgroundColor: palette.rail,
        borderTopColor: palette.border,
      },
      tabBarLabelStyle: { fontFamily: fonts.bodyMedium, fontSize: 11 },
      headerStyle: { backgroundColor: palette.surface },
      headerTitleStyle: {
        fontFamily: typeScale.h3.fontFamily,
        fontSize: typeScale.h3.fontSize,
        color: palette.textPrimary,
      },
      headerShadowVisible: false,
      tabBarIcon: ({ color, size }) => (
        <Ionicons name={tabIcons[route.name]} color={color} size={size} />
      ),
    })}
```

- [ ] **Step 2: Placeholder screen**

Full new `placeholder-screen.tsx`:

```tsx
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { type Palette } from '@colanode/mobile/theme/palette';
import { useTheme } from '@colanode/mobile/theme/theme-context';
import { spacing } from '@colanode/mobile/theme/tokens';
import { typeScale } from '@colanode/mobile/theme/typography';

const createStyles = (palette: Palette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: palette.background,
    },
    title: { ...typeScale.h3, color: palette.textPrimary },
    subtitle: { ...typeScale.body, color: palette.textMuted },
  });

interface PlaceholderScreenProps {
  title: string;
}

export const PlaceholderScreen = ({ title }: PlaceholderScreenProps) => {
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <View style={styles.container} testID={`placeholder-${title.toLowerCase()}`}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>Coming soon</Text>
    </View>
  );
};
```

- [ ] **Step 3: Settings screen**

Same migration pattern in `settings-screen.tsx` — `createStyles(palette)` factory + `useTheme()`/`useMemo` inside the components (both `ServerRow` and `SettingsScreen`; pass `styles` to `ServerRow` as a prop or derive inside it — derive inside, it already receives no theme). Style mapping (Mycel semantics — server domain/version is system info → mono):

```tsx
const createStyles = (palette: Palette) =>
  StyleSheet.create({
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.background,
    },
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
    },
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
    domain: {
      ...typeScale.caption,
      fontFamily: fonts.mono,
      color: palette.textMuted,
    },
    statusDot: { width: 9, height: 9, borderRadius: radius.full },
    empty: {
      ...typeScale.body,
      color: palette.textMuted,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    error: { ...typeScale.body, color: palette.danger },
  });
```

Status dot colors: available → `palette.accent` (the 9px spore dot — brand moment), unavailable → `palette.textFaint`. Loading indicator → `color={palette.accent}`.

Imports to add: `useMemo`; `fonts`, `labelTracking`, `typeScale` from `@colanode/mobile/theme/typography`; `radius`, `spacing` from tokens; `useTheme` + `Palette`. Remove the old `tokens` import.

- [ ] **Step 4: Sweep for stragglers**

```bash
grep -rn "theme/tokens'" apps/mobile/src | grep -v "spacing\|radius\|motion"
grep -rn "tokens\.colors" apps/mobile/src
```

Expected: no matches (no consumer of the deleted `tokens` export remains).

- [ ] **Step 5: Full gates + commit (Tasks 2+3+4)**

```bash
npm run test -w @colanode/mobile      # palette parity + M1 factory tests pass
npm run compile -w @colanode/mobile   # exit 0
cd apps/mobile && npx expo export --platform ios --output-dir /tmp/expo-export-m15 && cd ../..
git add apps/mobile
git commit -m "feat(mobile): Mycel design system — dual-theme palette, brand typography, themed shell"
```

---

### Task 5: Simulator verification — both themes (manual gate, no commit)

**Files:** none.

**Interfaces:**
- Consumes: the Mac build workflow from M1 plan Task 8 (same commands, same UDID).
- Produces: M1.5 exit evidence — light and dark screenshots.

- [ ] **Step 1: Build & launch** — same as M1 Task 8 Steps 1–2 (push branch, `npm ci`, `npx expo run:ios --device 50B1BC35-75C8-406E-977B-6E731AE92636`).

- [ ] **Step 2: Dark theme (primary)**

```bash
ssh mac 'xcrun simctl ui booted appearance dark && sleep 2 && xcrun simctl io booted screenshot /tmp/m15-dark.png'
scp mac:/tmp/m15-dark.png /tmp/
```

Checklist: deep moss background `#0B120F`; biolum-green active tab `#57D9A3` on near-black rail; headers in Bricolage Grotesque (clearly not system font); Settings "SERVERS" label in uppercase mono with tracking; server domain line in mono; green spore status dot.

- [ ] **Step 3: Light theme**

```bash
ssh mac 'xcrun simctl ui booted appearance light && sleep 2 && xcrun simctl io booted screenshot /tmp/m15-light.png'
scp mac:/tmp/m15-light.png /tmp/
```

Checklist: warm paper background `#F2F1EA`; forest-green accent `#177A55`; same type hierarchy; theme switches live without app restart (useColorScheme is reactive).

- [ ] **Step 4: Contrast sanity** — on both screenshots confirm text-muted on background remains readable (design system is WCAG AA-tuned; we verify nothing was mis-mapped).

---

## Self-Review Notes

- Spec coverage (M1.5 bullet): fonts ✓ (T1+T3), dual-theme palette dark-primary ✓ (T2), ThemeProvider/useTheme ✓ (T2), navigation/tab-bar restyle ✓ (T3+T4), migration of M1 screens ✓ (T4), both-themes verification ✓ (T5).
- Deliberately deferred (with rationale): `SyncStatus` spore-pulse component and `MessageBubble` → M3 chats, where they have real data to bind to; Mycel logo mark / app icon / splash rebrand → separate branding task (needs the final product name decision to also cover bundle id and store listing); `components/core/Button|Input|...` RN counterparts → built on demand starting M2 auth, following the design project's `components/core/*.prompt.md` specs.
- Type consistency: `fonts.*` names in `typography.ts` exactly match the `useFonts` keys in `app.tsx` (both use the @expo-google-fonts export names) — that pairing is what makes `fontFamily` resolve.
- Compile-gate note: Tasks 2–4 are one compile-clean series (the `tokens` export rewrite breaks consumers until T4) — they land as a single commit; tests stay green throughout.
