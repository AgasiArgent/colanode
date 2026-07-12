# Mycel Web Restyle — PR 3 (Primitives + Long Tail) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the shadcn primitives per the Mycel `components/core` specs (Button, Input, Checkbox, Chip⇄Badge, SegmentedControl⇄Tabs) and the overlay surfaces (Dialog/Popover/DropdownMenu: radii 20/16, elevations e2/e3, "grow" motion — never slide), plus the PR 2 review follow-ups (lint gate, reacted-chip hover).

**Architecture:** Class-string restyles of `packages/ui/src/components/ui/*` keeping every component API (variants, props, data-slots) intact — consumers don't change. Five new state tokens (`--primary-hover/active`, `--destructive-foreground/hover/active`) added TDD-style. Branch `mycel-pr3-primitives` is stacked on `mycel-pr2-chat-pixel-pass` (PR 2); the draft PR targets that branch as base.

**Tech Stack:** React 19, Tailwind v4, cva, Radix primitives, tw-animate-css, vitest.

**Spec:** `docs/superpowers/specs/2026-07-10-web-mycel-restyle-design.md` §7. Component contracts: `components/core/*.jsx` in the design project (values reproduced verbatim in the tasks below).

## Global Constraints

- Worktree root `/Users/andreynovikov/workspace/colanode/.claude/worktrees/web-mycel-restyle`, branch `mycel-pr3-primitives` (Task 1 creates it from `mycel-pr2-chat-pixel-pass`).
- Gates for every commit (LINT IS NEW): `npx turbo run build --filter=@colanode/ui^... && npm run compile -w @colanode/ui && npm run lint -w @colanode/ui && npm run test -w @colanode/ui && npm run test -w @colanode/web` — all pass.
- Component APIs are frozen: no variant renames, no prop changes, no data-slot changes. Restyle = class strings (plus the five new tokens).
- Radius utilities are Mycel-mapped: `rounded-sm`=8, `rounded-md`=12, `rounded-lg`=16, `rounded-xl`=20 px.
- Motion: surfaces GROW (fade + zoom), never slide — remove `slide-in-from-*` classes from overlay content. Micro-interactions stay ≤ ~120ms; panels 240ms.
- Copy token values verbatim from this plan. Brand green only via `primary` tokens; hover washes neutral.
- Do not touch `apps/mobile`.

---

### Task 1: Branch + lint-gate enablement (chore)

**Files:**
- Modify: whatever `npm run lint -w @colanode/ui` flags for `import/order` (known: `packages/ui/src/components/layouts/sidebars/sidebar-menu.tsx`, `packages/ui/src/components/layouts/sidebars/sidebar.tsx`, `packages/ui/src/features/bug-report/BugReportWidget.*`)

- [ ] **Step 1:** `git switch -c mycel-pr3-primitives`
- [ ] **Step 2:** Run `npm run lint -w @colanode/ui` — record the failures (expected: 5 pre-existing `import/order` errors). Fix them with `npx eslint --fix <files>` (import reordering only); re-run lint until clean with `--max-warnings 0`. If any error is NOT auto-fixable import/order, report it instead of hand-patching unrelated code.
- [ ] **Step 3:** Full gates (now including lint). Expected: all pass.
- [ ] **Step 4:** Commit: `chore(ui): fix pre-existing import/order lint errors, enable lint gate`

---

### Task 2: State tokens (TDD)

**Files:**
- Modify: `packages/ui/src/lib/themes.ts`, `packages/ui/src/lib/themes.test.ts`, `packages/ui/src/styles/globals.css`

**Interfaces:**
- Produces Tailwind utilities used by Tasks 3–6: `bg-primary-hover`, `bg-primary-active`, `text-destructive-foreground`, `bg-destructive-hover`, `bg-destructive-active`.

- [ ] **Step 1 (RED):** Add to `themes.test.ts` — light test: `expect(vars['--primary-hover']).toBe('#1E8F64'); expect(vars['--primary-active']).toBe('#115C40'); expect(vars['--destructive-foreground']).toBe('#FBFAF5');` dark test: `expect(vars['--primary-hover']).toBe('#6FE3B3'); expect(vars['--destructive-foreground']).toBe('#0B120F'); expect(vars['--destructive-active']).toBe('#C4604F');`
  Run `npm run test -w @colanode/ui -- themes` → FAIL.
- [ ] **Step 2 (GREEN):** In `themes.ts` add after `--primary-foreground` / after `--destructive` respectively:
  - light: `'--primary-hover': '#1E8F64', '--primary-active': '#115C40',` and `'--destructive-foreground': '#FBFAF5', '--destructive-hover': '#CB5A47', '--destructive-active': '#93382A',`
  - dark: `'--primary-hover': '#6FE3B3', '--primary-active': '#3FBF8A',` and `'--destructive-foreground': '#0B120F', '--destructive-hover': '#E8907F', '--destructive-active': '#C4604F',`
  In `globals.css` `@theme inline` add (after the corresponding existing lines):
  `--color-primary-hover: var(--primary-hover); --color-primary-active: var(--primary-active); --color-destructive-foreground: var(--destructive-foreground); --color-destructive-hover: var(--destructive-hover); --color-destructive-active: var(--destructive-active);` (one per line, matching file style).
  Test → PASS.
- [ ] **Step 3:** Gates + commit: `feat(ui): Mycel state tokens for primary/destructive hover and active`

---

### Task 3: Button per contract

**Files:**
- Modify: `packages/ui/src/components/ui/button.tsx`

Contract (Button.jsx): weight 700, radius 12 (`rounded-md` — already mapped), heights sm 30 / md 38, no shadows, disabled opacity .4, hover = explicit hover tokens, press darkens + scales (readme: scale .96), ghost = accent text on transparent, "secondary" spec look = surface + border (maps to shadcn `outline`).

- [ ] **Step 1:** Replace `buttonVariants` with:

```typescript
const buttonVariants = cva(
  "cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-bold transition-[background-color,color,transform] duration-[var(--motion-micro-duration)] ease-[var(--motion-micro-ease)] active:scale-[0.96] disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive-hover active:bg-destructive-active focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40',
        outline:
          'border border-border bg-card text-foreground hover:bg-accent hover:text-accent-foreground',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost:
          'text-primary hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9.5 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-7.5 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
        icon: 'size-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);
```

(Deltas: font-bold; explicit micro transition; active scale; opacity-40; all `shadow-xs` removed; default/destructive get contract hover/active tokens; destructive `text-white` → `text-destructive-foreground`; outline loses `dark:bg-input/30 dark:border-input`, gains `border-border bg-card`; ghost gains accent text; heights 38/30 via `h-9.5`/`h-7.5`. Everything else — Slot/asChild, data-slot, export — unchanged.)

- [ ] **Step 2:** Gates + visual sanity: `grep -rn "variant=\"ghost\"" packages/ui/src | head -5` — spot-open one consumer to confirm ghost-on-accent-text won't be nonsense there (icon-only ghost buttons are fine: icon turns accent). If a ghost consumer looks broken by accent text (e.g. large text menus), report it — do not add variants.
- [ ] **Step 3:** Commit: `feat(ui): Mycel button primitive — bold, state tokens, press scale, no shadows`

---

### Task 4: Input + Checkbox per contract

**Files:**
- Modify: `packages/ui/src/components/ui/input.tsx`, `packages/ui/src/components/ui/checkbox.tsx`

Contract: Input — h 40, radius 12, surface bg, border→accent on focus + 3px soft ring (accent 15%), padding 14px. Checkbox — 18px, radius 6, unchecked = surface bg + 1.5px `--border-strong` border, checked = accent fill.

- [ ] **Step 1: Input** — replace the three class strings with:

```tsx
      className={cn(
        'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground border-input bg-card flex h-10 w-full min-w-0 rounded-md border px-3.5 py-1 text-base transition-[color,border-color,box-shadow] duration-[var(--motion-micro-duration)] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        'focus-visible:border-primary focus-visible:ring-ring/15 focus-visible:ring-[3px]',
        'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
        className
      )}
```

(Deltas: h-9→h-10, bg-transparent+dark:bg-input/30→bg-card, px-3→px-3.5, shadow-xs removed, focus border→primary with ring/15.)

- [ ] **Step 2: Checkbox** — replace the Root class string with:

```tsx
      className={cn(
        'peer border-border-strong bg-card data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive size-[18px] shrink-0 rounded-[6px] border-[1.5px] transition-colors duration-[var(--motion-micro-duration)] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
```

(Deltas: size-4→size-[18px], rounded-[4px]→rounded-[6px], border→border-[1.5px] border-border-strong, dark:bg-input/30→bg-card, dark:data-[state=checked]:bg-primary and shadow-xs removed, transition-shadow→transition-colors with micro duration. Indicator/CheckIcon untouched.)

- [ ] **Step 3:** Gates + commit: `feat(ui): Mycel input and checkbox primitives`

---

### Task 5: Badge (Chip look) + Tabs (SegmentedControl look)

**Files:**
- Modify: `packages/ui/src/components/ui/badge.tsx`, `packages/ui/src/components/ui/tabs.tsx`

Contract: Chip — radius 8 (`rounded-sm`), padding 3×9, 11px bold (mono variants exist in the design but no Badge API change: existing four variants only, retoned). SegmentedControl — surface container with border, radius 12, inner padding 3, active segment = `--accent-soft` pill radius 9 bold.

- [ ] **Step 1: Badge** — in `badgeVariants`, base string: `rounded-md` → `rounded-sm`, `px-2 py-0.5 text-xs font-medium` → `px-2 py-0.5 text-[11px] font-bold`; variants:
  - `secondary`: `'border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90'` → `'border-transparent bg-sidebar text-muted-foreground [a&]:hover:bg-secondary/90'`
  - `destructive`: `text-white` → `text-destructive-foreground`, drop `dark:bg-destructive/60`
  - `default`, `outline`: unchanged.
- [ ] **Step 2: TabsList** — `'bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-lg p-[3px]'` → `'bg-card text-muted-foreground inline-flex h-9 w-fit items-center justify-center gap-0.5 rounded-md border border-border p-[3px]'`
- [ ] **Step 3: TabsTrigger** — replace the class string with:

```tsx
        "data-[state=active]:bg-primary-soft data-[state=active]:text-primary-soft-foreground data-[state=active]:font-bold focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring text-muted-foreground inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-[9px] border border-transparent px-3.5 py-1 text-sm font-medium whitespace-nowrap transition-[color,background-color] duration-[var(--motion-micro-duration)] focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
```

(Deltas: active = soft-green pill + bold instead of bg-background + shadow-sm; inactive text muted in both themes — drops the odd `text-foreground dark:text-muted-foreground` split; radius 9 = 12−3; px-2→px-3.5.)

- [ ] **Step 4:** Gates + commit: `feat(ui): Mycel badge chips and segmented-control tabs`

---

### Task 6: Overlay surfaces — grow motion, radii, elevations

**Files:**
- Modify: `packages/ui/src/components/ui/dialog.tsx`, `packages/ui/src/components/ui/popover.tsx`, `packages/ui/src/components/ui/dropdown-menu.tsx`, `packages/ui/src/components/ui/alert-dialog.tsx` (same DialogContent-style string), `packages/ui/src/components/ui/hover-card.tsx`, `packages/ui/src/components/ui/context-menu.tsx` (popover-style strings, if present — check each file; apply the same pattern)

Contract: modals radius 20 + shadow e3; menus/popovers radius 16 + shadow e2; surfaces GROW: fade + zoom 0.98→1, 240ms `--motion-panel-ease`; NEVER slide.

- [ ] **Step 1: DialogContent** (and AlertDialogContent if it has its own copy): in the content class string: `rounded-lg` → `rounded-xl`, `shadow-lg` → `shadow-e3`, `duration-200` → `duration-[var(--motion-panel-duration)] ease-[var(--motion-panel-ease)]`, `zoom-in-95`/`zoom-out-95` → `zoom-in-[0.98]`/`zoom-out-[0.98]`. If `zoom-in-[0.98]` fails to take effect (tw-animate-css arbitrary-value support — verify by building), fall back to `zoom-in-95` and note it in the report. Close-button block untouched.
- [ ] **Step 2: PopoverContent** — in the class string: remove all four `data-[side=*]:slide-in-from-*` classes; `rounded-md` → `rounded-lg`; `shadow-md` → `shadow-e2`; add `duration-[var(--motion-panel-duration)] ease-[var(--motion-panel-ease)]` and change zoom pair to `[0.98]` (same fallback rule).
- [ ] **Step 3: DropdownMenuContent + DropdownMenuSubContent** — same pattern as Step 2 (remove slides, `rounded-md`→`rounded-lg`, `shadow-md`→`shadow-e2`, panel duration/ease, zoom 0.98).
- [ ] **Step 4:** Check `hover-card.tsx`, `context-menu.tsx`, `sheet.tsx` for the same `slide-in-from-*`/`shadow-md|lg`/`rounded-md|lg` content patterns. Apply the same treatment to hover-card and context-menu. **Sheet is the exception:** a side sheet's slide IS its geometry (it enters from an edge) — leave sheet.tsx animations alone; only upgrade its shadow to `shadow-e3` if it uses a generic shadow.
- [ ] **Step 5:** Gates + a quick dev-server open of any dropdown (workspace switcher) to confirm menus fade-grow without sliding. Commit: `feat(ui): Mycel overlay surfaces — grow motion, radii 16/20, e2/e3 elevations`

---

### Task 7: PR 2 polish follow-ups

**Files:**
- Modify: `packages/ui/src/components/messages/message-reaction-counts.tsx`

- [ ] **Step 1:** Reacted-chip hover: in the `hasReacted` branch add a hover wash — `'border-border-strong bg-primary-soft text-primary-soft-foreground'` → `'border-border-strong bg-primary-soft text-primary-soft-foreground hover:bg-primary-soft/80'`.
- [ ] **Step 2:** Gates + commit: `fix(ui): hover feedback on reacted chips`

---

### Task 8: Long-tail visual sweep + stacked draft PR

**Files:** none (verification; fixes only if breakage found — each fix reported, minimal, committed separately).

- [ ] **Step 1:** Full gates (with lint).
- [ ] **Step 2:** `cd apps/web && npm run dev` — walk what is reachable without a server (login/auth screens) in both themes; with a live workspace if available: Settings (buttons/inputs/tabs), a database record dialog (dialog radius/shadow/motion), dropdown menus, page editor. Checklist: no sliding menus; no stray shadows on buttons; checkbox 18px readable; disabled buttons at 40%; both themes legible.
- [ ] **Step 3:** Screenshots (both themes) for the PR body.
- [ ] **Step 4:** Push + draft PR stacked on PR 2:

```bash
git push -u origin mycel-pr3-primitives
gh pr create --draft --base mycel-pr2-chat-pixel-pass --title "feat(ui): Mycel primitives + overlay motion (restyle PR 3/3)" --body "..."
```

(Body: summary per task, spec/plan links, gate checklist incl. the new lint gate, note the stack order #23 → #24 → this.)

---

## Self-review notes

- Spec §7 coverage: Button/Input/Checkbox/Tabs⇄SegmentedControl/Badge⇄Chip → T3–T5; dialog/popover/dropdown radii+shadows+grow motion → T6; long-tail sweep → T8; lint follow-up → T1; reacted-chip hover → T7. Avatar/MessageBubble/SyncStatus were covered in PR 1–2. Deferred, documented: Chip's extra tones (accent/success/warning) not added to Badge — no consumers yet (YAGNI); `#` glyph hover emphasis — cosmetic parity with pre-Mycel behavior; non-destructive placeholder live-update — `shortcut:` comment exists.
- Type consistency: new token names in T2 match usage in T3 (`bg-primary-hover` etc.); `--border-strong` (used by T4 checkbox) exists since PR 2 T5.
- Bounded fallbacks (not placeholders): T3 Step 2 ghost-consumer check → report, don't fix; T6 zoom-[0.98] → documented fallback to zoom-95; T6 Step 4 file check is enumerated (hover-card, context-menu, sheet with explicit sheet exception).
