# Rebrand & redesign — claude.ai/design briefs

Date: 2026-07-09

## Goal

Produce a bold new brand + UI design for the product (currently "Colanode" on
web/desktop, "Superchat" on iOS) using claude.ai/design, then implement it.

## Decisions locked during brainstorming

| Question | Decision |
| --- | --- |
| iOS approach | **Native React Native screens** (variant 3). Design targets Apple HIG patterns, not a WebView reflow. RN chosen over Swift because the local-first data layer (`packages/client`) and the Yjs CRDT are TypeScript and are reused as-is; only the UI is rebuilt. |
| Visual character | **Bold / unusual** — several radically different concepts to choose from, explicitly avoiding the current default-shadcn look. |
| Product name | No name chosen yet — claude.ai/design proposes a name **with each concept** so name and identity are born together. |
| Process | **Two stages.** Stage 1: 4 radical brand concepts (name + identity + one hero screen each). Pick a winner. Stage 2: expand the winner across 5 web screens + 5 iOS screens and extract design tokens. |

## Current state (inventory, for reference)

- Web/desktop UI: `packages/ui` (~400 components), React 19 + Tailwind v4 +
  shadcn/ui (new-york, essentially unthemed) + TipTap. Tokens live in
  `packages/ui/src/lib/themes.ts` (OKLCH, stock shadcn neutral + 7 stock
  accent themes). Satoshi/Antonio fonts bundled but barely used.
- iOS app (`apps/mobile`): Expo shell rendering the shared web UI in a
  WebView; no native screens exist yet. Data layer bridges via superjson
  (SQLite, filesystem, APNs push).
- No design docs / Figma anywhere in the repo. Logo is a monochrome
  `currentColor` SVG.

## How to use the prompts

1. Paste `2026-07-09-stage1-brand-concepts-prompt.md` into claude.ai/design.
2. Pick a winning concept (or iterate inside that session).
3. Fill the `[PASTE HERE ...]` block of
   `2026-07-09-stage2-screens-prompt.md` with the winner's name, palette,
   typography and motion notes (skip if continuing in the same session —
   then just say "use concept N") and run it.
4. Bring the resulting token list back to the repo: web tokens go into
   `packages/ui/src/lib/themes.ts`, the RN token module is created when
   native screens development starts.

## Out of scope (future work, separate specs)

- Implementation plan for restyling `packages/ui`.
- Native RN screen development plan (new app architecture on top of
  `packages/client`).
- Actual rename (bundle ids, manifests, server branding).
