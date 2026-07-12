# Native mobile app (React Native) — design

Date: 2026-07-10
Depends on: `2026-07-09-rebrand-design-prompts.md` (decision: iOS goes native RN)

## Goal

Replace the WebView UI in `apps/mobile` with native React Native screens.
Clean cut: the WebView application (`apps/mobile/src/ui/`) is removed, not
kept as a fallback. The app is iOS-first (push and device features are
iOS-only today); Android stays possible but out of scope.

## Why this is cheap (architecture facts)

- `AppService` (all of `packages/client`: SQLite via `expo-sqlite`,
  synchronizers, account WebSocket, jobs) **already runs natively on
  Hermes** — `apps/mobile/src/app.tsx` constructs it. The WebView is only a
  renderer talking to `app.mediator` over a superjson bridge.
- The data hooks in `packages/ui` (`use-query`, `use-live-query`,
  `use-mutation`) and the TanStack DB collections (`collections/nodes.ts`)
  are DOM-free; they depend only on the `window.colanode` /
  `window.eventBus` contract (`packages/ui/src/window.ts`).
- In RN, `window === global`, so the contract can be fulfilled by an
  **in-process shim** over `app.mediator` — the fourth transport after
  Comlink worker (web), Electron IPC (desktop) and the WebView bridge
  (mobile today), and the only one with zero serialization.

## Decisions

| Question | Decision |
| --- | --- |
| Migration strategy | Clean native from scratch; WebView app deleted (app is experimental, nothing to preserve) |
| Data access | **Shim + reuse `packages/ui` hooks/collections verbatim** (approach 1). No `ui-core` extraction now; revisit once native proves itself |
| Navigation | `react-navigation` (bottom-tabs + native-stack). No expo-router: no deep links needed yet, less magic with the existing custom Metro entry |
| Page editing | **TipTap island**: reading is a native ProseMirror-JSON renderer; editing embeds the existing TipTap editor (with its Yjs binding) in a document-sized WebView with a native toolbar. Zero risk to CRDT sync; all rich blocks for free |
| Styling | M1 ships provisional neutral tokens; the **Mycel** design system (claude.ai/design project `b08894a6-0794-47ed-9bee-5a3f8934be84`, tokens in `tokens/*.css`, dark theme primary) lands as milestone **M1.5** between M1 and M2, so every real screen (M2+) is built in the final visual language |
| Phase 1 scope | Auth + shell + chats + inbox + spaces tree + pages (native read, island edit). Databases/folders show an "open on desktop" stub |

## Architecture

```
apps/mobile/src/
  app.tsx            — bootstrap AppService (unchanged flow) → shim → navigation
  data/shim.ts       — window.colanode + window.eventBus over app.mediator
  navigation/        — tab bar (Chats / Spaces / Inbox / Settings) + stacks
  screens/           — auth/ chats/ inbox/ spaces/ pages/ settings/
  components/        — MessageBubble, Avatar, NodeIcon, EmptyState, …
  theme/tokens.ts    — provisional design tokens (colors, spacing, type)
  editor-island/     — M7: Vite entry building editor.html (TipTap + Yjs)
```

- **Removed:** `apps/mobile/src/ui/` (WebView app, bridge client, fonts
  shim). The Vite single-file pipeline is kept and repurposed in M7 to
  build `editor-island/` instead of the whole UI.
- **Kept unchanged:** `src/services/*` (Kysely/expo-sqlite, FileSystem,
  paths, push), `MobileErrorBoundary`, EAS config, APNs entitlements.
- **Kept dependency:** `react-native-webview` (used only by the editor
  island and future OAuth flows).
- From `packages/ui` native code imports **only** `hooks/` and
  `collections/` (plus pure `lib/` utilities). DOM components must not
  enter the Metro bundle — verifying Metro handles these subpath imports is
  risk #1 and the first task of M1.

## Data flow

Screen → `packages/ui` hook (`useLiveQuery`) → shim →
`app.mediator.executeQueryAndSubscribe` → SQLite. Updates: synchronizers
(already running natively) → `eventBus` → shim subscription → TanStack
invalidation → re-render. Mutations return `{ success, output } |
{ success: false, error }` exactly as on web.

Key data operations (all existing, none added):

| Need | Operation |
| --- | --- |
| Chats/channels list | `nodes` collection filtered by `type` (`node.list` underneath) |
| Messages (paginated) | infinite query, `type=='message' && parentId==id`, page 50 |
| Send message | `message.create` (plain-text composer producing minimal JSONContent in M3) |
| Unread badges | `radar.data.get`, `notification.unread-count` |
| Mark read | `node.interaction.seen` / `node.interaction.opened` |
| Auth | `server.list/create`, `email.login`, `email.register`, `account.list`, `workspace.list` |
| Page content | `document.state.get` + document update mutations (island only) |

## Milestones

- **M1 Shell.** Native root replaces WebView; shim; navigation skeleton
  (4 tabs + stacks); provisional tokens; proof: a screen renders live
  `server.list` data through a `packages/ui` hook. Includes the Metro
  bundling spike for partial `packages/ui` imports.
- **M1.5 Mycel design integration.** Fonts (Bricolage Grotesque / Karla /
  Spline Sans Mono via expo-google-fonts), dual-theme palette (dark primary),
  ThemeProvider + useTheme, navigation/tab-bar restyle, migration of M1
  screens off the provisional tokens. Source of truth: claude.ai/design
  project "Workspace brand concepts" (`tokens/*.css`, `components/core/*`,
  `Mycel Product.dc.html`).
- **M2 Auth.** Server picker/add; email login + register; workspace
  picker; Settings tab with account info and logout. App boots to login
  when no account, to Chats otherwise.
- **M3 Chats (core).** Chats + channels lists with unread indicators;
  conversation screen: paginated message list, message bubbles with a
  mini-renderer for message JSONContent (paragraphs, bold/italic/code,
  links, mentions), plain-text composer → `message.create`, mark-seen,
  optimistic send (local-first gives this for free), long-press actions
  (copy; react later).
- **M4 Inbox.** Notification list (mentions, replies, invites), read/unread
  states, tab badges.
- **M5 Spaces.** Space list → node tree (channels, pages, folders,
  databases); channels open chat, pages open M6 viewer, databases/folders
  show "open on desktop".
- **M6 Pages (read).** Native renderer ProseMirror-JSON → RN views:
  headings, paragraphs, marks, lists, checklists, code blocks, quotes,
  tables (simple), images (via `FileSystem.url`). Unknown blocks render a
  labeled placeholder — never crash.
- **M7 Editor island.** `editor-island/` Vite single-file build hosting the
  existing TipTap config + Yjs binding from the web editor; RN page screen
  swaps the native viewer for the island on "Edit"; native toolbar above
  the keyboard drives TipTap commands; island ↔ Hermes messaging reuses a
  slimmed version of the current superjson bridge; document updates flow
  through existing document mutations.

Each milestone ends runnable in the iOS simulator and lands as its own
implementation plan.

## Error handling

- Mediator failures → toast with `error.code`/`message`; no silent
  swallowing.
- Offline is not an error: mutations queue locally (existing behavior);
  the composer never blocks on connectivity.
- Root `MobileErrorBoundary` stays; per-screen error states for empty and
  failed queries.
- Editor island: load timeout → retry UI (mirror of today's WebView retry),
  fallback to native read-only view.

## Testing

- Vitest for pure modules: shim (contract conformance against a mediator
  stub), ProseMirror-JSON → block-tree mapper, composer text → JSONContent.
- Screens: manual verification in the iOS simulator per milestone
  (headless sim-driving workflow already established).
- Type safety: `tsc` across `apps/mobile` in CI (query/mutation types come
  from `QueryMap`/`MutationMap` declaration merging — compile-time checked).

## Out of scope (phase 1)

Database views (table/kanban/calendar), folder/file browser, search,
reactions UI beyond long-press copy, Android, workspace creation,
the visual redesign itself (arrives as a token swap + component restyle
after claude.ai/design), push-enable UX changes.

## Risks

1. **Metro + partial `packages/ui` imports** (DOM components leaking into
   the bundle) — spiked first in M1; mitigation: dedicated subpath exports
   in `packages/ui/package.json` for `hooks`/`collections` if needed.
2. **TanStack DB collections assume long-lived subscriptions** — verify
   memory behavior when screens unmount (mobile lifecycles are harsher than
   a browser tab).
3. **Editor island keyboard/viewport quirks** — known WKWebView territory;
   contained to one screen, native read view is the fallback.
