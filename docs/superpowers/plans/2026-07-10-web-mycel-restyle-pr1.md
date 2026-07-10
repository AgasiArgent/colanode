# Mycel Web Restyle — PR 1 (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the stock shadcn theme with the Mycel design system foundation: token palettes (light+dark), self-hosted fonts, radius/motion tokens, message bubbles, mono accents, spore-amber unread badges, the spore-pulse sync indicator, and removal of the 7 user accent themes.

**Architecture:** shadcn CSS variable names stay as the semantic layer; `packages/ui/src/lib/themes.ts` supplies Mycel values verbatim from the design contract. New Mycel-specific variables (spore, bubbles, primary-soft, rail, elevations) are added to `themes.ts` and exposed as Tailwind utilities via `@theme inline` in `globals.css`. Fonts flow through the existing pipeline: committed in root `assets/fonts/` → copied by `scripts/src/postinstall/index.ts` to `apps/web/public/assets/fonts` and `apps/desktop/assets/fonts` → `@font-face` injected at runtime by `app-assets.tsx`. Sync status gets a small client-side query (`mutation.pending-count`) invalidated by a new `mutation.queue.changed` event published from `MutationService`.

**Tech Stack:** React 19, Tailwind v4 (`@theme inline`), TypeScript, Kysely (client SQLite), vitest (via `apps/web`), Colanode live-query system (`useLiveQuery` from `@colanode/ui/hooks/use-live-query`).

**Spec:** `docs/superpowers/specs/2026-07-10-web-mycel-restyle-design.md`

## Global Constraints

- Copy color values **verbatim** from the table in this plan (they are the design contract's hex values) — never adjust by eye.
- shadcn `--accent` is the hover/selected wash (neutral), NOT the brand green. Brand green goes to `--primary`.
- Dark is the primary theme; unknown system scheme resolves to dark.
- Sentence case in all copy; sync-status copy is plain lowercase mono ("saved locally", "synced", "offline") — no organism metaphor in text.
- No gradients, no glassmorphism; emoji never in UI chrome.
- Working directory: repo root of the `web-mycel-restyle` worktree. All commands run from there unless stated.
- Gates for every commit: `npm run compile -w @colanode/ui` and `npm run test -w @colanode/web` pass.
- Satoshi font files stay in root `assets/fonts/` and keep being copied to `apps/mobile` only (mobile still consumes them; its restyle is a separate track). Antonio is deleted everywhere.
- `#` channel glyph work is **PR 2** (sidebar currently renders node avatars, not `#` marks) — do not add it here.

---

### Task 1: Mycel font files + postinstall pipeline

**Files:**
- Create: `assets/fonts/bricolage-grotesque-variable.woff2`, `assets/fonts/karla-variable.woff2`, `assets/fonts/karla-italic.woff2`, `assets/fonts/spline-sans-mono-variable.woff2` (binary, downloaded)
- Delete: `assets/fonts/antonio.ttf`
- Modify: `scripts/src/postinstall/index.ts`

**Interfaces:**
- Produces: font files available at `apps/web/public/assets/fonts/<name>` and `apps/desktop/assets/fonts/<name>` after `node scripts/src/postinstall/index.ts` (or `npm install`). Filenames above are relied on by Task 2.

- [ ] **Step 1: Download the four variable woff2 files (latin subset) from the Google Fonts css2 API**

```bash
cd assets/fonts
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

fetch_latin() {
  # $1 = css2 URL, $2 = output file. Picks the /* latin */ subset's woff2 URL.
  curl -s -A "$UA" "$1" \
    | awk 'BEGIN{RS="@font-face"} /\/\* latin \*\//{if (match($0,/url\(https:[^)]+\)/)) print substr($0,RSTART+4,RLENGTH-5)}' \
    | tail -1 | xargs curl -so "$2"
}

fetch_latin 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&display=swap' bricolage-grotesque-variable.woff2
fetch_latin 'https://fonts.googleapis.com/css2?family=Karla:ital,wght@0,400..700;1,400&display=swap' karla-variable.woff2
curl -s -A "$UA" 'https://fonts.googleapis.com/css2?family=Karla:ital,wght@1,400&display=swap' \
  | awk 'BEGIN{RS="@font-face"} /italic/ && /\/\* latin \*\//{if (match($0,/url\(https:[^)]+\)/)) print substr($0,RSTART+4,RLENGTH-5)}' \
  | tail -1 | xargs curl -so karla-italic.woff2
fetch_latin 'https://fonts.googleapis.com/css2?family=Spline+Sans+Mono:wght@300..700&display=swap' spline-sans-mono-variable.woff2
```

Note: the first `fetch_latin` for Karla requests both ital axes but the `/* latin */` upright block is what gets picked; the separate italic request grabs the italic file. If `awk` extraction yields an empty file, fall back to opening the css2 URL manually and copying the latin `url(...)` by hand.

- [ ] **Step 2: Verify the downloads are real woff2 files**

Run: `file *.woff2 && ls -la *.woff2`
Expected: each file reported as `Web Open Font Format (Version 2)`, sizes roughly 20–80 KB. If any file is HTML or 0 bytes, redo Step 1 for it.

- [ ] **Step 3: Delete Antonio and return to repo root**

```bash
rm antonio.ttf
cd ../..
```

- [ ] **Step 4: Update `scripts/src/postinstall/index.ts`**

Replace the font constants block (lines ~17–26) with:

```typescript
const SATOSHI_FONT_NAME = 'satoshi-variable.woff2';
const SATOSHI_ITALIC_FONT_NAME = 'satoshi-variable-italic.woff2';
const MYCEL_FONT_NAMES = [
  'bricolage-grotesque-variable.woff2',
  'karla-variable.woff2',
  'karla-italic.woff2',
  'spline-sans-mono-variable.woff2',
];
const FONTS_DIR = path.resolve(ASSETS_DIR, 'fonts');
const FONTS_SATOSHI_PATH = path.resolve(FONTS_DIR, SATOSHI_FONT_NAME);
const FONTS_SATOSHI_ITALIC_PATH = path.resolve(
  FONTS_DIR,
  SATOSHI_ITALIC_FONT_NAME
);
```

Replace the font copy block inside `execute()` (the three `copyFile(FONTS_SATOSHI_PATH, ...)` / `FONTS_SATOSHI_ITALIC_PATH` / `FONTS_ANTONIO_PATH` calls) with:

```typescript
  // shortcut: satoshi is still shipped to apps/mobile only — the mobile app
  // (separate restyle track) loads it via data URIs. Remove these two copies
  // and the root satoshi files when mobile moves to Mycel fonts.
  copyFile(
    FONTS_SATOSHI_PATH,
    path.resolve(MOBILE_ASSETS_DIR, 'fonts', SATOSHI_FONT_NAME)
  );
  copyFile(
    FONTS_SATOSHI_ITALIC_PATH,
    path.resolve(MOBILE_ASSETS_DIR, 'fonts', SATOSHI_ITALIC_FONT_NAME)
  );

  for (const fontName of MYCEL_FONT_NAMES) {
    copyFile(path.resolve(FONTS_DIR, fontName), [
      path.resolve(DESKTOP_ASSETS_DIR, 'fonts', fontName),
      path.resolve(WEB_ASSETS_DIR, 'fonts', fontName),
    ]);
  }
```

Remove the now-unused `ANTONIO_FONT_NAME` / `FONTS_ANTONIO_PATH` constants entirely.

- [ ] **Step 5: Run postinstall and verify copies**

Run: `node --experimental-strip-types scripts/src/postinstall/index.ts 2>/dev/null || (cd scripts && npx tsx src/postinstall/index.ts)`
Then: `ls apps/web/public/assets/fonts/ apps/desktop/assets/fonts/`
Expected: the four Mycel woff2 files present in both; `antonio.ttf` may linger in git-ignored copy dirs (harmless — those dirs are regenerated) but must be gone from `assets/fonts/`.

- [ ] **Step 6: Commit**

```bash
git add assets/fonts scripts/src/postinstall/index.ts
git commit -m "feat(ui): add Mycel font files to asset pipeline, drop antonio"
```

---

### Task 2: Runtime @font-face + font class migration

**Files:**
- Modify: `packages/ui/src/components/app/app-assets.tsx`
- Modify: `packages/ui/src/components/app/app-loading.tsx:9`
- Modify: `packages/ui/src/components/auth/auth-layout.tsx:22`

**Interfaces:**
- Consumes: font filenames from Task 1.
- Produces: font families `"Bricolage Grotesque"`, `"Karla"`, `"Spline Sans Mono"` registered at runtime. Task 3 maps them to Tailwind utilities `font-display` / `font-sans` / `font-mono`.

- [ ] **Step 1: Rewrite `app-assets.tsx`**

Replace the entire style content (keep the mobile early-return and `fontPrefix` logic unchanged):

```tsx
import { useApp } from '@colanode/ui/contexts/app';

export const AppAssets = () => {
  const app = useApp();

  // Mobile loads fonts via Vite-inlined data: URIs (see apps/mobile MobileFonts)
  // because the React Native WebView can't resolve the local:// scheme that the
  // Electron desktop app uses. Emitting the local:// @font-face here too would
  // just produce failing requests, so skip it on mobile.
  if (app.type === 'mobile') {
    return null;
  }

  const fontPrefix = app.type === 'web' ? `/assets/fonts` : `local://fonts`;

  return (
    <style>{`
      @font-face {
        font-family: "Bricolage Grotesque";
        src: url('${fontPrefix}/bricolage-grotesque-variable.woff2') format("woff2-variations"),
            url('${fontPrefix}/bricolage-grotesque-variable.woff2') format("woff2");
        font-weight: 400 800;
        font-style: normal;
        font-display: swap;
      }

      @font-face {
        font-family: "Karla";
        src: url('${fontPrefix}/karla-variable.woff2') format("woff2-variations"),
            url('${fontPrefix}/karla-variable.woff2') format("woff2");
        font-weight: 400 700;
        font-style: normal;
        font-display: swap;
      }

      @font-face {
        font-family: "Karla";
        src: url('${fontPrefix}/karla-italic.woff2') format("woff2");
        font-weight: 400;
        font-style: italic;
        font-display: swap;
      }

      @font-face {
        font-family: "Spline Sans Mono";
        src: url('${fontPrefix}/spline-sans-mono-variable.woff2') format("woff2-variations"),
            url('${fontPrefix}/spline-sans-mono-variable.woff2') format("woff2");
        font-weight: 300 700;
        font-style: normal;
        font-display: swap;
      }
    `}</style>
  );
};
```

(The `.font-satoshi` / `.font-antonio` classes are gone; Tailwind utilities from Task 3 replace them.)

- [ ] **Step 2: Migrate the two `font-satoshi` usages**

In `app-loading.tsx` line 9: `className="font-satoshi tracking-tight text-4xl"` → `className="font-display tracking-tight text-4xl"`.
In `auth-layout.tsx` line 22: `className="font-satoshi text-3xl tracking-tight"` → `className="font-display text-3xl tracking-tight"`.

- [ ] **Step 3: Verify no stale references remain**

Run: `grep -rn "satoshi\|antonio" packages/ui/src apps/web/src`
Expected: no matches.

- [ ] **Step 4: Gates**

Run: `npm run compile -w @colanode/ui && npm run test -w @colanode/web`
Expected: both pass. (`font-display` utility does not exist until Task 3 — that's fine, an unknown class renders unstyled and compile/tests don't check CSS. Tasks 2+3 land in one commit if you prefer strict no-intermediate-breakage; otherwise proceed.)

- [ ] **Step 5: Commit (or hold and commit together with Task 3)**

```bash
git add packages/ui/src/components/app/app-assets.tsx packages/ui/src/components/app/app-loading.tsx packages/ui/src/components/auth/auth-layout.tsx
git commit -m "feat(ui): register Mycel fonts at runtime, drop satoshi/antonio faces"
```

---

### Task 3: globals.css — fonts, radius scale, new token mappings, motion

**Files:**
- Modify: `packages/ui/src/styles/globals.css`

**Interfaces:**
- Consumes: font family names from Task 2; runtime variables that Task 4 will define (`--primary-soft`, `--spore`, `--bubble-*`, `--rail`, `--elevation-*`).
- Produces: Tailwind utilities `font-sans` (Karla), `font-display` (Bricolage), `font-mono` (Spline Sans Mono), `bg-spore`, `text-spore-foreground`, `bg-spore-soft`, `bg-primary-soft`, `text-primary-soft-foreground`, `bg-bubble-own`, `bg-bubble-other`, `text-bubble-other-foreground`, `border-bubble-other-border`, `bg-rail`, `bg-success`/`-soft`, `shadow-e1/e2/e3`; radius utilities `rounded-sm|md|lg|xl` = 8/12/16/20 px; keyframes `spore-pulse`, `spore-ripple`; motion CSS variables.

- [ ] **Step 1: Update the `@theme inline` block**

Replace the four radius lines at the top of `@theme inline` with fixed contract values and add font + new color + shadow mappings (keep every existing `--color-*` line):

```css
@theme inline {
  --font-sans: 'Karla', system-ui, sans-serif;
  --font-display: 'Bricolage Grotesque', system-ui, sans-serif;
  --font-mono: 'Spline Sans Mono', ui-monospace, monospace;
  --radius-sm: 0.5rem;
  --radius-md: 0.75rem;
  --radius-lg: 1rem;
  --radius-xl: 1.25rem;
  /* ...existing --color-* mappings stay unchanged... */
  --color-primary-soft: var(--primary-soft);
  --color-primary-soft-foreground: var(--primary-soft-foreground);
  --color-spore: var(--spore);
  --color-spore-foreground: var(--spore-foreground);
  --color-spore-soft: var(--spore-soft);
  --color-spore-soft-foreground: var(--spore-soft-foreground);
  --color-success: var(--success);
  --color-success-soft: var(--success-soft);
  --color-success-soft-foreground: var(--success-soft-foreground);
  --color-bubble-own: var(--bubble-own);
  --color-bubble-own-foreground: var(--bubble-own-foreground);
  --color-bubble-other: var(--bubble-other);
  --color-bubble-other-foreground: var(--bubble-other-foreground);
  --color-bubble-other-border: var(--bubble-other-border);
  --color-rail: var(--rail);
  --shadow-e1: var(--elevation-1);
  --shadow-e2: var(--elevation-2);
  --shadow-e3: var(--elevation-3);
}
```

- [ ] **Step 2: Add motion variables and keyframes after the `@layer base` block**

```css
:root {
  /* Mycel motion contract (tokens/motion.css). Surfaces grow, never slide. */
  --motion-micro-duration: 120ms;
  --motion-micro-ease: ease-out;
  --motion-panel-duration: 240ms;
  --motion-panel-ease: cubic-bezier(0.22, 1, 0.36, 1);
  --motion-spore-period: 2.6s;
  --motion-spore-ripple: 600ms;
}

/* Signature sync animation — applied to the 9px spore dot */
@keyframes spore-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--primary) 45%, transparent);
  }
  50% {
    box-shadow: 0 0 0 7px transparent;
  }
}

@keyframes spore-ripple {
  0% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--primary) 55%, transparent);
  }
  100% {
    box-shadow: 0 0 0 12px transparent;
  }
}
```

- [ ] **Step 3: Gates**

Run: `npm run compile -w @colanode/ui && npm run test -w @colanode/web`
Expected: pass (utilities referencing not-yet-defined runtime vars are legal CSS — they resolve once Task 4 lands).

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/styles/globals.css
git commit -m "feat(ui): Mycel fonts, radius scale, token utilities and motion in globals"
```

---

### Task 4: themes.ts rewrite + ThemeColor removal

**Files:**
- Modify: `packages/ui/src/lib/themes.ts` (full rewrite)
- Create: `packages/ui/src/lib/themes.test.ts`
- Modify: `packages/client/src/types/themes.ts` (remove `ThemeColor`)
- Modify: `packages/ui/src/contexts/theme.ts` (remove `color`)
- Modify: `packages/ui/src/components/app/app-theme-provider.tsx` (drop color plumbing)
- Modify: `packages/ui/src/components/app/app-appearance-container.tsx` (remove Color section)
- Modify: `packages/ui/src/hooks/use-system-theme.ts` (unknown scheme → dark)

**Interfaces:**
- Produces: `getThemeVariables(mode: ThemeMode): Record<string, string>` (single parameter). Runtime CSS variables consumed by Task 3's utilities and Tasks 5–8. `ThemeColor` no longer exists anywhere.

- [ ] **Step 1: Write the failing test**

Create `packages/ui/src/lib/themes.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';

import { getThemeVariables } from '@colanode/ui/lib/themes';

describe('getThemeVariables', () => {
  it('returns the Mycel light palette', () => {
    const vars = getThemeVariables('light');
    expect(vars['--background']).toBe('#F2F1EA');
    expect(vars['--primary']).toBe('#177A55');
    expect(vars['--sidebar']).toBe('#EDECE3');
    expect(vars['--spore']).toBe('#A96B1B');
    expect(vars['--bubble-other-border']).toBe('#E0DED4');
    expect(vars['--radius']).toBe('0.75rem');
  });

  it('returns the Mycel dark palette', () => {
    const vars = getThemeVariables('dark');
    expect(vars['--background']).toBe('#0B120F');
    expect(vars['--primary']).toBe('#57D9A3');
    expect(vars['--primary-foreground']).toBe('#0B120F');
    expect(vars['--rail']).toBe('#080D0B');
    expect(vars['--bubble-other-border']).toBe('transparent');
  });

  it('keeps the shadcn hover wash neutral, not brand green', () => {
    expect(getThemeVariables('light')['--accent']).toBe('#EDECE3');
    expect(getThemeVariables('dark')['--accent']).toBe('#1A2721');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w @colanode/web -- themes`
Expected: FAIL (values are stock oklch, and `getThemeVariables` requires two args).

- [ ] **Step 3: Rewrite `packages/ui/src/lib/themes.ts`**

Full new content:

```typescript
import { ThemeMode } from '@colanode/client/types';

// Mycel palette. Values are the design contract's hex — copied verbatim from
// tokens/colors.css of the Mycel design project; do not adjust by eye.
// Note: shadcn --accent is the neutral hover/selected wash; the brand green
// lives in --primary.

const baseVariables = {
  '--radius': '0.75rem',
};

const lightVariables = {
  '--background': '#F2F1EA',
  '--foreground': '#1C2420',
  '--card': '#FBFAF5',
  '--card-foreground': '#1C2420',
  '--popover': '#FFFFFF',
  '--popover-foreground': '#1C2420',
  '--primary': '#177A55',
  '--primary-foreground': '#FBFAF5',
  '--primary-soft': '#DDEBE1',
  '--primary-soft-foreground': '#14352A',
  '--secondary': '#EDECE3',
  '--secondary-foreground': '#1C2420',
  '--muted': '#EDECE3',
  '--muted-foreground': '#5C6B62',
  '--accent': '#EDECE3',
  '--accent-foreground': '#1C2420',
  '--destructive': '#B94A38',
  '--border': '#E0DED4',
  '--input': '#E0DED4',
  '--ring': '#177A55',
  '--spore': '#A96B1B',
  '--spore-foreground': '#FBFAF5',
  '--spore-soft': '#EFE0C6',
  '--spore-soft-foreground': '#5A431E',
  '--success': '#1E7A3E',
  '--success-soft': '#CFE4D6',
  '--success-soft-foreground': '#14532E',
  '--bubble-own': '#E2EDE2',
  '--bubble-own-foreground': '#1C2420',
  '--bubble-other': '#FBFAF5',
  '--bubble-other-foreground': '#1C2420',
  '--bubble-other-border': '#E0DED4',
  '--rail': '#E7E5DC',
  '--elevation-1': '0 2px 8px rgba(28, 36, 32, 0.08)',
  '--elevation-2': '0 8px 28px rgba(28, 36, 32, 0.10)',
  '--elevation-3': '0 12px 40px rgba(28, 36, 32, 0.14)',
  '--chart-1': 'oklch(0.646 0.222 41.116)',
  '--chart-2': 'oklch(0.6 0.118 184.704)',
  '--chart-3': 'oklch(0.398 0.07 227.392)',
  '--chart-4': 'oklch(0.828 0.189 84.429)',
  '--chart-5': 'oklch(0.769 0.188 70.08)',
  '--sidebar': '#EDECE3',
  '--sidebar-foreground': '#1C2420',
  '--sidebar-primary': '#177A55',
  '--sidebar-primary-foreground': '#FBFAF5',
  '--sidebar-accent': '#DDEBE1',
  '--sidebar-accent-foreground': '#14352A',
  '--sidebar-border': '#E0DED4',
  '--sidebar-ring': '#177A55',
};

const darkVariables = {
  '--background': '#0B120F',
  '--foreground': '#E6EFE9',
  '--card': '#121B16',
  '--card-foreground': '#E6EFE9',
  '--popover': '#1A2721',
  '--popover-foreground': '#E6EFE9',
  '--primary': '#57D9A3',
  '--primary-foreground': '#0B120F',
  '--primary-soft': '#1E3B2F',
  '--primary-soft-foreground': '#A8EACB',
  '--secondary': '#1A2721',
  '--secondary-foreground': '#E6EFE9',
  '--muted': '#1A2721',
  '--muted-foreground': '#8FA69A',
  '--accent': '#1A2721',
  '--accent-foreground': '#E6EFE9',
  '--destructive': '#E07A6B',
  '--border': '#1E2C25',
  '--input': '#1E2C25',
  '--ring': '#57D9A3',
  '--spore': '#D9A05B',
  '--spore-foreground': '#0B120F',
  '--spore-soft': '#2E2A1A',
  '--spore-soft-foreground': '#E4D3B9',
  '--success': '#6FD98F',
  '--success-soft': '#1E3B2F',
  '--success-soft-foreground': '#A8EACB',
  '--bubble-own': '#1E3B2F',
  '--bubble-own-foreground': '#E6EFE9',
  '--bubble-other': '#121B16',
  '--bubble-other-foreground': '#C8D6CD',
  '--bubble-other-border': 'transparent',
  '--rail': '#080D0B',
  '--elevation-1': '0 2px 8px rgba(0, 0, 0, 0.25)',
  '--elevation-2': '0 8px 28px rgba(0, 0, 0, 0.35)',
  '--elevation-3': '0 12px 40px rgba(0, 0, 0, 0.45)',
  '--chart-1': 'oklch(0.488 0.243 264.376)',
  '--chart-2': 'oklch(0.696 0.17 162.48)',
  '--chart-3': 'oklch(0.769 0.188 70.08)',
  '--chart-4': 'oklch(0.627 0.265 303.9)',
  '--chart-5': 'oklch(0.645 0.246 16.439)',
  '--sidebar': '#0E1512',
  '--sidebar-foreground': '#E6EFE9',
  '--sidebar-primary': '#57D9A3',
  '--sidebar-primary-foreground': '#0B120F',
  '--sidebar-accent': '#1E3B2F',
  '--sidebar-accent-foreground': '#A8EACB',
  '--sidebar-border': '#1A2721',
  '--sidebar-ring': '#57D9A3',
};

export const getThemeVariables = (mode: ThemeMode): Record<string, string> => {
  return {
    ...baseVariables,
    ...(mode === 'light' ? lightVariables : darkVariables),
  };
};
```

- [ ] **Step 4: Remove `ThemeColor` from `packages/client/src/types/themes.ts`**

New full content:

```typescript
export type ThemeMode = 'light' | 'dark';
```

- [ ] **Step 5: Remove `color` from the theme context (`packages/ui/src/contexts/theme.ts`)**

```typescript
import { createContext, useContext } from 'react';

import { ThemeMode } from '@colanode/client/types';

interface ThemeContext {
  mode: ThemeMode;
}

export const ThemeContext = createContext<ThemeContext>({} as ThemeContext);

export const useTheme = () => useContext(ThemeContext);
```

- [ ] **Step 6: Simplify `app-theme-provider.tsx`**

- Remove `ThemeColor` from the import of `@colanode/client/types`.
- `useApplyTheme(mode: ThemeMode)` — drop the `color` parameter; second `useEffect` calls `getThemeVariables(mode)` with `[mode]` deps.
- In `AppThemeProviderInitialized`: delete the `const [themeColor] = useMetadata<ThemeColor>('app', 'theme.color');` line; call `useApplyTheme(resolvedThemeMode)`; provide `value={{ mode: resolvedThemeMode }}`.
- In `AppThemeProviderUninitialized`: `useApplyTheme(systemTheme)`; provide `value={{ mode: systemTheme }}`.

(Persisted `theme.color` metadata is simply never read again — no migration needed; the typecheck gate proves no runtime path still consumes it.)

- [ ] **Step 7: Remove the Color section from `app-appearance-container.tsx`**

- Delete the `themeColorOptions` array, the `<h2>Color</h2>` block and the whole swatch grid `<div className="grid ... max-w-2xl">…</div>`.
- Delete `const [themeColor, setThemeColor] = useMetadata('app', 'theme.color');`.
- Remove `ThemeColor` from imports.

- [ ] **Step 8: Unknown scheme → dark in `use-system-theme.ts`**

Change the early return `return 'light';` (the `typeof window === 'undefined' || !window.matchMedia` branch) to `return 'dark';` — Mycel's primary theme is dark.

- [ ] **Step 9: Run tests**

Run: `npm run compile -w @colanode/ui && npm run test -w @colanode/web`
Expected: compile passes (all `ThemeColor` references are gone — if it fails, the error list IS the remaining-cleanup list); the new `themes.test.ts` passes; existing suites pass.

- [ ] **Step 10: Commit**

```bash
git add packages/ui/src/lib/themes.ts packages/ui/src/lib/themes.test.ts packages/client/src/types/themes.ts packages/ui/src/contexts/theme.ts packages/ui/src/components/app/app-theme-provider.tsx packages/ui/src/components/app/app-appearance-container.tsx packages/ui/src/hooks/use-system-theme.ts
git commit -m "feat(ui): replace stock shadcn palette with Mycel tokens, drop accent themes"
```

---

### Task 5: Message bubbles + mono timestamps

**Files:**
- Modify: `packages/ui/src/components/messages/message.tsx:142` (wrap `MessageContent`)
- Modify: `packages/ui/src/components/messages/message-time.tsx:17`

**Interfaces:**
- Consumes: `bg-bubble-other`, `text-bubble-other-foreground`, `border-bubble-other-border` utilities (Task 3) backed by Task 4 values.
- Produces: bubble presentation for all message rows (channels, chats, thread panel — they all render through `message.tsx`).

- [ ] **Step 1: Wrap message content in a bubble in `message.tsx`**

Replace `<MessageContent message={message} />` (line ~142) with:

```tsx
            <div className="w-fit max-w-full rounded-[4px_16px_16px_16px] border border-bubble-other-border bg-bubble-other px-3.5 py-2.5 text-bubble-other-foreground">
              <MessageContent message={message} />
            </div>
```

Notes: radius `4px 16px 16px 16px` puts the anchor corner top-left, toward the avatar. The dark theme border token is `transparent`, so no conditional is needed. `message-reference.tsx` (quoted preview) keeps its own plain `MessageContent` rendering — do NOT wrap there.

- [ ] **Step 2: Mono timestamp in `message-time.tsx`**

Line 17: `className="ml-2 text-xs text-muted-foreground"` → `className="ml-2 font-mono text-[11px] text-muted-foreground/70"`.

- [ ] **Step 3: Gates**

Run: `npm run compile -w @colanode/ui && npm run test -w @colanode/web`
Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/components/messages/message.tsx packages/ui/src/components/messages/message-time.tsx
git commit -m "feat(ui): Mycel message bubbles with anchor corner, mono timestamps"
```

---

### Task 6: Unread badges → spore amber

**Files:**
- Modify: `packages/ui/src/components/ui/unread-badge.tsx`

**Interfaces:**
- Consumes: `bg-spore`, `text-spore-foreground` utilities.
- Produces: nothing new — same `UnreadBadge` props API.

- [ ] **Step 1: Swap the hardcoded reds for spore tokens**

In `unread-badge.tsx`: count badge classes `'rounded-md px-1.5 py-0.5 text-xs bg-red-400 text-white'` → `'rounded-md px-1.5 py-0.5 text-xs font-medium bg-spore text-spore-foreground'`; dot classes `'size-2 rounded-full bg-red-500'` → `'size-2 rounded-full bg-spore'`.

- [ ] **Step 2: Check for other hardcoded unread reds**

Run: `grep -rn "bg-red-" packages/ui/src/components/layouts packages/ui/src/components/ui | grep -i "unread\|badge"`
Expected: no remaining unread-related reds (destructive-action reds elsewhere are out of scope — leave them).

- [ ] **Step 3: Gates + commit**

Run: `npm run compile -w @colanode/ui && npm run test -w @colanode/web` — expected pass.

```bash
git add packages/ui/src/components/ui/unread-badge.tsx
git commit -m "feat(ui): spore amber unread badges"
```

---

### Task 7: Client plumbing — mutation queue event + pending-count query

**Files:**
- Modify: `packages/client/src/types/events.ts`
- Modify: `packages/client/src/services/workspaces/mutation-service.ts`
- Create: `packages/client/src/queries/mutations/mutation-pending-count.ts`
- Modify: `packages/client/src/queries/index.ts`
- Create: `packages/client/src/handlers/queries/mutations/mutation-pending-count.ts`
- Modify: `packages/client/src/handlers/queries/index.ts`

**Interfaces:**
- Produces:
  - Event `{ type: 'mutation.queue.changed'; workspace: WorkspaceEventData; pendingCount: number }` in the `Event` union.
  - Query `'mutation.pending-count'` — input `{ type: 'mutation.pending-count'; userId: string }`, output `MutationPendingCountQueryOutput = { pendingCount: number; serverAvailable: boolean }`. Task 8's `useLiveQuery({ type: 'mutation.pending-count', userId })` relies on these exact names.

- [ ] **Step 1: Add the event type**

In `packages/client/src/types/events.ts`, next to the other workspace-scoped events add:

```typescript
export type MutationQueueChangedEvent = {
  type: 'mutation.queue.changed';
  workspace: WorkspaceEventData;
  pendingCount: number;
};
```

and add `MutationQueueChangedEvent` to the exported `Event` union type at the bottom of the file.

- [ ] **Step 2: Publish the event from `MutationService`**

In `packages/client/src/services/workspaces/mutation-service.ts`:

Add imports:

```typescript
import { eventBus } from '@colanode/client/lib/event-bus';
```

(Match the exact import path used by `node-service.ts` — check its `eventBus` import and copy it.)

Add a private method:

```typescript
  private async publishQueueState(): Promise<void> {
    const row = await this.workspace.database
      .selectFrom('mutations')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .executeTakeFirst();

    eventBus.publish({
      type: 'mutation.queue.changed',
      workspace: {
        workspaceId: this.workspace.workspaceId,
        userId: this.workspace.userId,
        accountId: this.workspace.accountId,
      },
      pendingCount: row?.count ?? 0,
    });
  }
```

Call it in two places:
1. At the end of `scheduleSync()` (after `addJob`): `await this.publishQueueState();` — covers the moment right after any service inserts a mutation (every insert site calls `scheduleSync`).
2. In `sync()`: convert the existing `try { ... } catch { ... }` to `try { ... } catch { ... } finally { await this.publishQueueState(); }` — covers queue drain and failure states.

- [ ] **Step 3: Create the query input**

`packages/client/src/queries/mutations/mutation-pending-count.ts`:

```typescript
export type MutationPendingCountQueryInput = {
  type: 'mutation.pending-count';
  userId: string;
};

export type MutationPendingCountQueryOutput = {
  pendingCount: number;
  serverAvailable: boolean;
};

declare module '@colanode/client/queries' {
  interface QueryMap {
    'mutation.pending-count': {
      input: MutationPendingCountQueryInput;
      output: MutationPendingCountQueryOutput;
    };
  }
}
```

Register in `packages/client/src/queries/index.ts` (alphabetical placement with the other exports):

```typescript
export * from './mutations/mutation-pending-count';
```

- [ ] **Step 4: Create the query handler**

`packages/client/src/handlers/queries/mutations/mutation-pending-count.ts`:

```typescript
import { WorkspaceQueryHandlerBase } from '@colanode/client/handlers/queries/workspace-query-handler-base';
import { ChangeCheckResult, QueryHandler } from '@colanode/client/lib/types';
import {
  MutationPendingCountQueryInput,
  MutationPendingCountQueryOutput,
} from '@colanode/client/queries/mutations/mutation-pending-count';
import { Event } from '@colanode/client/types/events';

export class MutationPendingCountQueryHandler
  extends WorkspaceQueryHandlerBase
  implements QueryHandler<MutationPendingCountQueryInput>
{
  public async handleQuery(
    input: MutationPendingCountQueryInput
  ): Promise<MutationPendingCountQueryOutput> {
    const workspace = this.getWorkspace(input.userId);

    const row = await workspace.database
      .selectFrom('mutations')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .executeTakeFirst();

    return {
      pendingCount: row?.count ?? 0,
      serverAvailable: workspace.account.server.isAvailable,
    };
  }

  public async checkForChanges(
    event: Event,
    input: MutationPendingCountQueryInput,
    _: MutationPendingCountQueryOutput
  ): Promise<ChangeCheckResult<MutationPendingCountQueryInput>> {
    if (
      event.type === 'workspace.deleted' &&
      event.workspace.userId === input.userId
    ) {
      return {
        hasChanges: true,
        result: { pendingCount: 0, serverAvailable: false },
      };
    }

    if (
      event.type === 'mutation.queue.changed' &&
      event.workspace.userId === input.userId
    ) {
      const result = await this.handleQuery(input);
      return { hasChanges: true, result };
    }

    if (
      event.type === 'account.connection.opened' ||
      event.type === 'account.connection.closed' ||
      event.type === 'server.availability.changed'
    ) {
      const result = await this.handleQuery(input);
      return { hasChanges: true, result };
    }

    return { hasChanges: false };
  }
}
```

Note: `account.connection.*` / `server.availability.changed` event payload shapes vary — this handler deliberately re-queries on any of them (cheap COUNT) rather than matching account ids, to stay payload-agnostic. If `getWorkspace` throws for a deleted workspace inside `checkForChanges`, wrap that re-query in try/catch returning `{ hasChanges: false }` — copy the exact defensive pattern only if the compile or an existing handler shows it's needed.

Register in `packages/client/src/handlers/queries/index.ts`: add the import and the map entry `'mutation.pending-count': new MutationPendingCountQueryHandler(app),` alongside the existing entries.

- [ ] **Step 5: Gates**

Run: `npm run compile -w @colanode/ui && npm run test -w @colanode/web`
Expected: pass. (The client package is typechecked transitively through `@colanode/ui`'s compile since packages import TS sources.)

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/types/events.ts packages/client/src/services/workspaces/mutation-service.ts packages/client/src/queries/mutations packages/client/src/queries/index.ts packages/client/src/handlers/queries/mutations packages/client/src/handlers/queries/index.ts
git commit -m "feat(client): mutation queue changed event and pending-count query"
```

---

### Task 8: SidebarSyncStatus component

**Files:**
- Create: `packages/ui/src/lib/sync-status.ts`
- Create: `packages/ui/src/lib/sync-status.test.ts`
- Create: `packages/ui/src/components/layouts/sidebars/sidebar-sync-status.tsx`
- Modify: `packages/ui/src/components/layouts/sidebars/sidebar.tsx`

**Interfaces:**
- Consumes: query `'mutation.pending-count'` (Task 7); keyframe `spore-pulse` + `--motion-spore-period` (Task 3); `bg-primary`, `bg-spore`, `bg-card` tokens (Task 4).
- Produces: `getSyncStatusView(pendingCount: number, serverAvailable: boolean): SyncStatusView` and the `SidebarSyncStatus` component mounted at the bottom of the sidebar panel.

- [ ] **Step 1: Write the failing test**

`packages/ui/src/lib/sync-status.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';

import { getSyncStatusView } from '@colanode/ui/lib/sync-status';

describe('getSyncStatusView', () => {
  it('shows saved locally with pulse while mutations are pending', () => {
    expect(getSyncStatusView(3, true)).toEqual({
      label: 'saved locally',
      tone: 'accent',
      pulse: true,
    });
  });

  it('shows synced when the queue is empty and the server is available', () => {
    expect(getSyncStatusView(0, true)).toEqual({
      label: 'synced',
      tone: 'accent',
      pulse: false,
    });
  });

  it('shows offline in spore tone when the server is unavailable', () => {
    expect(getSyncStatusView(0, false)).toEqual({
      label: 'offline',
      tone: 'spore',
      pulse: false,
    });
    expect(getSyncStatusView(5, false)).toEqual({
      label: 'offline',
      tone: 'spore',
      pulse: false,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w @colanode/web -- sync-status`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the view-model**

`packages/ui/src/lib/sync-status.ts`:

```typescript
export interface SyncStatusView {
  label: 'saved locally' | 'synced' | 'offline';
  tone: 'accent' | 'spore';
  pulse: boolean;
}

export const getSyncStatusView = (
  pendingCount: number,
  serverAvailable: boolean
): SyncStatusView => {
  if (!serverAvailable) {
    return { label: 'offline', tone: 'spore', pulse: false };
  }

  if (pendingCount > 0) {
    return { label: 'saved locally', tone: 'accent', pulse: true };
  }

  return { label: 'synced', tone: 'accent', pulse: false };
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -w @colanode/web -- sync-status`
Expected: PASS.

- [ ] **Step 5: Create the component**

`packages/ui/src/components/layouts/sidebars/sidebar-sync-status.tsx`:

```tsx
import { useWorkspace } from '@colanode/ui/contexts/workspace';
import { useLiveQuery } from '@colanode/ui/hooks/use-live-query';
import { getSyncStatusView } from '@colanode/ui/lib/sync-status';
import { cn } from '@colanode/ui/lib/utils';

export const SidebarSyncStatus = () => {
  const workspace = useWorkspace();

  const pendingCountQuery = useLiveQuery({
    type: 'mutation.pending-count',
    userId: workspace.userId,
  });

  const data = pendingCountQuery.data ?? {
    pendingCount: 0,
    serverAvailable: true,
  };
  const view = getSyncStatusView(data.pendingCount, data.serverAvailable);

  return (
    <div className="mx-2 mb-2 flex items-center gap-2.5 rounded-[14px] bg-card px-3 py-2.5">
      <span
        className={cn(
          'size-[9px] shrink-0 rounded-full',
          view.tone === 'spore' ? 'bg-spore' : 'bg-primary',
          view.pulse &&
            'animate-[spore-pulse_var(--motion-spore-period)_ease-in-out_infinite]'
        )}
      />
      <span className="font-mono text-[11px] leading-none text-muted-foreground">
        {view.label}
      </span>
    </div>
  );
};
```

- [ ] **Step 6: Mount it at the bottom of the sidebar panel**

In `packages/ui/src/components/layouts/sidebars/sidebar.tsx`, restructure the second column so the menus scroll and the status card sits at the bottom:

```tsx
      <SidebarMenu value={menu} onChange={setMenu} />
      <div className="flex min-h-0 grow flex-col border-l border-sidebar-border">
        <div className="min-h-0 grow overflow-auto">
          {menu === 'spaces' && <SidebarSpaces />}
          {menu === 'chats' && <SidebarChats />}
          {menu === 'inbox' && <InboxPanel userId={workspace.userId} />}
          {menu === 'settings' && <SidebarSettings />}
        </div>
        <SidebarSyncStatus />
      </div>
```

Add the import: `import { SidebarSyncStatus } from '@colanode/ui/components/layouts/sidebars/sidebar-sync-status';`

- [ ] **Step 7: Gates**

Run: `npm run compile -w @colanode/ui && npm run test -w @colanode/web`
Expected: pass (including `sidebar-menu.test.tsx`, untouched by this restructuring).

- [ ] **Step 8: Commit**

```bash
git add packages/ui/src/lib/sync-status.ts packages/ui/src/lib/sync-status.test.ts packages/ui/src/components/layouts/sidebars/sidebar-sync-status.tsx packages/ui/src/components/layouts/sidebars/sidebar.tsx
git commit -m "feat(ui): spore-pulse sync status card in sidebar"
```

---

### Task 9: Visual verification + draft PR

**Files:** none (verification and shipping).

- [ ] **Step 1: Full gates**

Run: `npm run compile -w @colanode/ui && npm run test -w @colanode/web`
Expected: all pass.

- [ ] **Step 2: Dev-server visual pass, both themes**

Run: `cd apps/web && npm run dev` (server deps per CLAUDE.md if a live workspace is needed). Check, in dark then light (Settings → Appearance):
- App shell: green-toned neutrals, no stray stock-gray surfaces; sidebar/rail/background differ in depth.
- Chat: bubbles with top-left anchor corner; mono timestamps; hover row wash is neutral (NOT green) — if hover is green, `--accent` mapping is wrong (see Global Constraints).
- Sidebar bottom: sync card; send a message offline-ish (or watch briefly) — dot pulses then settles; label text is lowercase mono.
- Unread badges are amber.
- Appearance settings: only System/Light/Dark, no color swatches.
- Fonts: headings on loading/auth screens are Bricolage; body is Karla; DevTools Network shows woff2 loaded from `/assets/fonts/`, zero requests to fonts.googleapis.com.
- Long-tail smoke: Settings pages, a database record dialog, page editor, login screen — readable, no black-on-black/white-on-white.

- [ ] **Step 3: Screenshots for the PR**

Capture the chat screen in dark and light (plus Appearance settings) — before/after if the stock build is handy (main branch dev server).

- [ ] **Step 4: Push and open draft PR**

```bash
git push -u origin worktree-web-mycel-restyle
gh pr create --draft --title "feat(ui): Mycel design system foundation (restyle PR 1/3)" --body "$(cat <<'EOF'
## Summary
- Replace stock shadcn palette with Mycel tokens (light+dark, dark primary) in packages/ui
- Self-host Bricolage Grotesque / Karla / Spline Sans Mono; remove Satoshi/Antonio from web+desktop (mobile keeps Satoshi)
- Message bubbles with anchor corner, mono timestamps, spore-amber unread badges
- Spore-pulse sync status card in the sidebar (new mutation.pending-count query + mutation.queue.changed event)
- Remove the 7 user-selectable accent themes; System/Light/Dark toggle stays

Spec: docs/superpowers/specs/2026-07-10-web-mycel-restyle-design.md (PR 1 of 3; PR 2 = chat pixel pass, PR 3 = primitives per component specs)

## Test plan
- [ ] npm run compile -w @colanode/ui
- [ ] npm run test -w @colanode/web (new: themes.test.ts, sync-status.test.ts)
- [ ] Manual visual pass in both themes (screenshots below)
- Desktop (Electron) inherits the restyle via packages/ui — not separately tested here

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01TyPiAn2BP5ZuRBvsUarYnz
EOF
)"
```

---

## Self-review notes

- **Spec coverage (PR 1 scope):** tokens §3 → Task 4; new vars §3.2 → Tasks 3+4; radius/motion §3.3 → Tasks 3+4; theme plumbing §3.4 → Task 4; fonts §4 → Tasks 1–3; bubbles/mono §5.1–5.2 → Task 5 (mono `#` deferred to PR 2 — sidebar renders avatars today, see Global Constraints); sync status §5.3 → Tasks 7–8; badges §5.4 → Task 6; appearance §5.5 → Task 4; verification §9 → Task 9 and per-task gates. Spec §9.3's "persisted theme.color does not break rendering" is covered by the typecheck gate: after Task 4 no runtime path reads `theme.color` (the metadata key is simply never queried), so no runtime regression is possible.
- **Sidebar section labels** (uppercase mono, spec §5.2): `SidebarHeader` styling ships with the PR 2 sidebar pass together with the `#` marks — one coherent sidebar diff instead of two half-passes. Noted as a conscious scope split.
- **Type consistency:** `getThemeVariables(mode)` single-arg used in Task 4 test and provider; query key `'mutation.pending-count'` and output `{ pendingCount, serverAvailable }` identical in Tasks 7 and 8; font file names identical in Tasks 1 and 2.
- **Known simplifications carried from spec §11:** no "· N peers", single-line sync label (two-line layout in PR 2), `--bubble-own` defined but unused until PR 2.
