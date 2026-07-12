# Native Mobile M7 — Editor Island Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Page editing on mobile: tapping "Edit" on the page screen swaps the native viewer for a document-sized WebView hosting the EXISTING web TipTap editor (full extensions, Yjs pipeline, zero CRDT risk), driven by a small native toolbar; "Done" returns to the native viewer showing the saved content.

**Architecture:** The island is a Vite single-file build (`apps/mobile/editor-island/`) that mounts the shared `Document` component from `packages/ui` inside a minimal shell: a postMessage bridge re-implements `window.colanode`/`window.eventBus` (resurrecting the pre-M1 superjson wire protocol, native end now routed to `app.mediator`), the ui `collections` singleton is preloaded over that bridge, and a `WorkspaceContext.Provider` supplies session identity. TanStack Router (only reached via `FileBlock`'s `<Link>`) is stubbed at the Vite alias level. Document updates cross the bridge as base64 strings (the existing `document.update` mutation contract) — no binary serialization concerns. The native side hosts the WebView, relays bridge traffic, and renders a Mycel toolbar that posts `editor_command` messages executed as TipTap chain commands in the island.

**Spec:** `docs/superpowers/specs/2026-07-10-native-mobile-app-design.md` (milestone M7)

## Global Constraints

- Prerequisites: M1–M6 landed. Gates: `npm run compile -w @colanode/mobile`, `npm run test -w @colanode/mobile`, plus the island build `npm run build:editor -w @colanode/mobile`.
- Reference sources (verified): pre-M1 bridge protocol — `git show 6ec7b234^:apps/mobile/src/ui/main.tsx` (pendingPromises map, superjson envelope, console piping) and `git show 6ec7b234^:apps/mobile/src/lib/types.ts` (Message union); pre-M1 vite config — `git show 6ec7b234^:apps/mobile/vite.config.ts` (CRITICAL pieces: `esbuild: { jsx: 'automatic', jsxImportSource: 'react' }` — the shared tsconfig's `jsx: "react-native"` otherwise crashes the WebView with "Can't find variable: React"; `resolve.dedupe: ['react','react-dom']`; the `@colanode/*` source aliases; `viteSingleFile` with `assetsInlineLimit`).
- Web editor contract (verified): `Document` (`packages/ui/src/components/documents/document.tsx`) needs only `{ node: LocalNode, canEdit, autoFocus? }` + `useWorkspace()` context `{ userId, accountId, workspaceId, role, collections }` + working `window.colanode`/`window.eventBus`; it runs `document.state.get` + `document.updates.list` live queries and `DocumentEditor` saves via mutation `document.update { userId, documentId, update: base64 }` (debounced 500ms), applying remote updates with caret preservation. `FileBlock` imports `Link` from `@tanstack/react-router` — the ONLY router coupling; stub it via a Vite alias module (pattern precedent: the `@agent-native/core` stub in `apps/web/vite.config.js`).
- Permission: gate Edit on `hasNodeRole(workspace.role as never, 'editor')`? NO — workspace-level role is not the node role. Compute the node role like the web does: `extractNodeRole(root, userId)` needs the root node; SIMPLIFICATION for M7 (`shortcut:` in code): show Edit when `workspace.role` is not `guest`/`none` and rely on `document-service.canUpdateDocument` (authoritative, already enforced) to reject unauthorized saves loudly.
- Island ↔ native messages (superjson over postMessage), envelope union `IslandMessage`:
  - island→native: `init` (ready signal), `mutation {mutationId, input}`, `query {queryId, input}`, `query_and_subscribe {queryId, key, input}`, `query_unsubscribe {key}`, `console {level, message}`, `content_saved` (fired after a successful document.update — native uses it for the "Done" freshness), `editor_ready`
  - native→island: `init_result { userId, accountId, workspaceId, role, node (LocalNode of the page), theme: 'light'|'dark' }`, `mutation_result {mutationId, result}`, `query_result {queryId, result}`, `query_and_subscribe_result {queryId, key, result}`, `event {event}`, `editor_command { command: 'bold'|'italic'|'strike'|'code'|'heading1'|'heading2'|'bulletList'|'taskList'|'undo'|'redo' }`
- Mycel note: the island's content renders with the web (shadcn) styling since `packages/ui` styles aren't Mycel yet (separate web-restyle track) — accepted for v1, documented.

---

### Task 1: Island app — Vite build, bridge client, editor shell

**Files:**
- Create: `apps/mobile/editor-island/index.html` (minimal `<div id="root">` + script `./main.tsx`)
- Create: `apps/mobile/editor-island/main.tsx` (bridge client + mount)
- Create: `apps/mobile/editor-island/router-stub.tsx`
- Create: `apps/mobile/editor-island/island-types.ts` (the `IslandMessage` union — shared with the native side via `@colanode/mobile/...`? NO: island compiles under Vite, native under Metro; put the union in `apps/mobile/src/island/island-messages.ts` and import it from BOTH sides — the vite alias `@colanode/mobile` → `./src` makes it resolvable in the island)
- Create: `apps/mobile/vite.editor.config.ts`
- Create: `apps/mobile/postcss.config.mjs` (restore: `@tailwindcss/postcss` plugin — required for `packages/ui` styles)
- Modify: `apps/mobile/package.json` (devDeps: `vite`, `vite-plugin-singlefile`, `@vitejs/plugin-react`, `@tailwindcss/postcss`, `react-dom`, `@types/react-dom`; scripts: `"build:editor": "vite build --config vite.editor.config.ts"`, `"eas-build-post-install": "npm run build:editor"`)
- Modify: `apps/mobile/src/asset-modules.d.ts` (re-add `*.html` module declaration)
- Verify gitignored: `apps/mobile/assets/editor/` output (extend .gitignore if the existing `assets/ui` pattern doesn't cover it — check root/.gitignore history from pre-M1)

**Interfaces:**
- Produces: `assets/editor/index.html` single-file bundle; `IslandMessage` union in `apps/mobile/src/island/island-messages.ts`.

- [ ] **Step 1: Message union** — `src/island/island-messages.ts` typed per Global Constraints (mirror the deleted `lib/types.ts` envelope style: each request/response pair with ids; import types from `@colanode/client/*` as TYPE-ONLY).

- [ ] **Step 2: Vite config** — `vite.editor.config.ts` cloned from the pre-M1 config with: `root: resolve(__dirname, 'editor-island')`, `build.outDir: '../assets/editor'`, `emptyOutDir: true`, `assetsInlineLimit: 100000000`, plugins `[react(), viteSingleFile()]`, `esbuild: { jsx: 'automatic', jsxImportSource: 'react' }`, `resolve.dedupe: ['react','react-dom']`, aliases `@colanode/{mobile→./src, core, crdt, client, ui}` + `{ find: '@tanstack/react-router', replacement: resolve(__dirname, 'editor-island/router-stub.tsx') }`.

- [ ] **Step 3: Router stub** — `router-stub.tsx`: export `Link` (renders `<span>{children}</span>`), `useNavigate: () => () => undefined`, `useLocation: () => ({ pathname: '' })` — ONLY what `packages/ui` file/document components reference (grep `from '@tanstack/react-router'` under `packages/ui/src/components/files` and `components/documents` and stub exactly that surface; if other transitively-mounted components need more, extend the stub, do NOT pull the real router).

- [ ] **Step 4: Bridge client + mount** — `editor-island/main.tsx`, structure (resurrect the pendingPromises pattern from `git show 6ec7b234^:apps/mobile/src/ui/main.tsx`, trimmed to the island message set):

```tsx
// 1. pendingPromises Map + window.colanode = { executeQuery, executeMutation,
//    executeQueryAndSubscribe, unsubscribeQuery, init: noop-success, ... } posting
//    superjson IslandMessages via window.ReactNativeWebView.postMessage
// 2. window.eventBus = eventBus (from @colanode/client/lib); inbound
//    'event' messages -> eventBus.publish
// 3. console piping (log/warn/error) -> 'console' messages
// 4. inbound 'init_result': set theme class on <html>, await collections.preload(),
//    build WorkspaceContext value { userId, accountId, workspaceId, role,
//    collections: collections.workspace(userId) }, then createRoot(...).render(
//      <WorkspaceContext.Provider value={...}>
//        <Document node={node} canEdit autoFocus="start" />
//      </WorkspaceContext.Provider>)
//    and post 'editor_ready'
// 5. inbound 'editor_command': execute on the TipTap editor. The Document/
//    DocumentEditor owns the editor instance — expose it via the editor's
//    onCreate? DocumentEditor doesn't accept onCreate; instead grab it from
//    the DOM: the EditorContent root carries .ProseMirror; use the tiptap
//    Editor instance registry — VERIFY how web menus access the editor
//    (packages/ui/src/editor/menus/* receive `editor` prop from DocumentEditor).
//    Simplest robust approach: patch nothing — wrap Document in a tiny
//    IslandEditorBridge component that uses the same EditorContext the menus
//    use IF one exists; otherwise (executor: check document-editor.tsx) add a
//    module-level `let activeEditor` set by an `onEditorReady` callback prop —
//    ONLY if DocumentEditor already exposes one; if it exposes nothing, fall
//    back to document.querySelector('.ProseMirror') focus + execCommand-free
//    approach: maintain our own thin command map via ProseMirror view from
//    window.__tiptapEditor if the web code sets it... FINAL RULE: if no clean
//    hook exists, add an optional `onEditorCreate?: (editor) => void` prop to
//    DocumentEditor in packages/ui (small, backwards-compatible, web unaffected)
//    and thread it from Document. That is the sanctioned cross-package change.
// 6. import '@colanode/ui/styles/globals.css' for tailwind styling
```

- [ ] **Step 5: Build gate**

```bash
npm run build:editor -w @colanode/mobile   # expect assets/editor/index.html
ls -la apps/mobile/assets/editor/index.html
```

Contingency: if the build fails on `@agent-native/*` imports pulled through `packages/ui` barrels (the pre-existing tabler-icons issue that killed the OLD build:ui), add the same regex alias stub `apps/web/vite.config.js` uses for `@agent-native/core` — copy it verbatim.

- [ ] **Step 6: Gates + commit** (`compile`, `test`, commit `feat(mobile): editor island vite app with colanode bridge client`).

---

### Task 2: Native host — bridge server, edit mode, toolbar

**Files:**
- Create: `apps/mobile/src/island/island-host.tsx` (WebView + bridge server + toolbar)
- Create: `apps/mobile/src/island/editor-toolbar.tsx`
- Modify: `apps/mobile/src/screens/spaces/page-screen.tsx` (Edit/Done header button; edit mode swaps body for `<IslandHost …>`)
- Modify: `apps/mobile/src/lib/assets.ts` (export `editorHtmlAsset` — `import editorHtmlAsset from '../../assets/editor/index.html'`)

**Interfaces:**
- Consumes: `IslandMessage` union; `app.mediator` — NOT directly: the host uses `window.colanode` (the in-process shim) for mutation/query and `window.eventBus` for the event feed — the island bridge is a client of the SAME contract, so the host needs no AppService plumbing.
- Produces: `IslandHost({ node, onSaved })` and the Edit-mode page screen.

- [ ] **Step 1: IslandHost** — patterned on the pre-M1 `app.tsx` WebView block (`git show 6ec7b234^:apps/mobile/src/app.tsx`, lines ~190-450): load `editorHtmlAsset` via `expo-asset` `Asset.fromModule(...).downloadAsync()`, render `<WebView source={{uri}} originWhitelist={['*']} allowFileAccess allowFileAccessFromFileURLs allowingReadAccessToURL={baseDir} javaScriptEnabled onMessage={handleMessage} webviewDebuggingEnabled={__DEV__} />`. `handleMessage`: superjson-parse `IslandMessage`; `query`/`mutation`/`query_and_subscribe` → `window.colanode.executeQuery/executeMutation/executeQueryAndSubscribe` and post results back; `query_unsubscribe` → `window.colanode.unsubscribeQuery`; forward ALL `window.eventBus.subscribe` events into the island as `event` messages (subscribe on mount, unsubscribe on unmount); `console` → prefixed `console.*`; `init` → respond `init_result` with `{ userId, accountId, workspaceId, role: workspace.role, node, theme: isDark ? 'dark' : 'light' }`; `content_saved` → `onSaved()`. Retry/error UI on WebView load failure (mirror the old error state). 30s `editor_ready` timeout → error state with retry.

- [ ] **Step 2: Toolbar** — `editor-toolbar.tsx`: a horizontal `ScrollView` row of Mycel icon buttons above the keyboard (`KeyboardAvoidingView` handled by the host layout): bold, italic, strikethrough, code, H1, H2, bullet list, task list, undo, redo (`Ionicons`; active-state feedback omitted for v1 — `shortcut:` note: island→native selection-state sync later). Each tap posts `editor_command` into the WebView via `webViewRef.current.postMessage(superjson.stringify(...))`.

- [ ] **Step 3: Page screen edit mode** — `page-screen.tsx`: `headerRight` button "Edit" (visible when `workspace.role !== 'guest' && workspace.role !== 'none'`; `shortcut:` comment re node-level role per Global Constraints) toggles `editing`; edit mode renders `<IslandHost node={pageNode} onSaved={noop}/>` + `<EditorToolbar …/>` instead of the ScrollView; header button becomes "Done" → back to the native viewer (which live-reflects the saved content via M6's `useDocumentContent`). Get `pageNode` from `collections.nodes` findOne (it is a `LocalNode` — the island needs `id` and `rootId`).

- [ ] **Step 4: Gates + commit**

```bash
npm run build:editor -w @colanode/mobile
npm run test -w @colanode/mobile && npm run compile -w @colanode/mobile
cd apps/mobile && npx expo export --platform ios --output-dir /tmp/expo-export-m7 && cd ../..
git add apps/mobile
git commit -m "feat(mobile): page editing via TipTap editor island with native toolbar"
```

(If Task 1 Step 4's FINAL RULE required the `onEditorCreate` prop in `packages/ui`, that change lands in Task 1's commit with a clear message: `feat(ui): optional onEditorCreate hook on DocumentEditor for the mobile island`.)

---

### Task 3: Simulator verification (manual gate, no commit)

Mac workflow as M5/M6 (prebuild --clean if exsqlite3; NOTE: `eas-build-post-install` now needs `assets/editor/index.html` — run `npm run build:editor -w @colanode/mobile` in the clone BEFORE `expo run:ios`, the file is gitignored). Session: mcp-agent on the test server.

- [ ] **Step 1: Build island + app, launch, sign in.**
- [ ] **Step 2: Open a page → Edit.** The island loads (no white flash > 2s — the asset is local), existing content appears in the TipTap editor. Screenshot.
- [ ] **Step 3: Type text; toolbar bold/H1/task-list buttons apply formatting visibly.** Screenshot.
- [ ] **Step 4: Save round-trip.** Wait >1s (debounce), tap Done → the NATIVE viewer shows the new content (M6 live queries); verify server-side via MCP `colanode_get_document` (or Postgres) that the document contains the typed text. Screenshot.
- [ ] **Step 5: Remote-update while editing.** Update the page via MCP while the island is open → content refreshes in the editor (DocumentEditor's remote-apply path). If flaky, document precisely (known web behavior: full setContent replace).
- [ ] **Step 6: CRDT sanity.** Edit the same page from web/desktop AND mobile in sequence; both edits survive (no lost updates). 
- [ ] **Step 7: Report** + screenshots via SendUserFile.

---

## Self-Review Notes

- Spec coverage (M7): editor island via the existing Vite-singlefile approach ✓, existing TipTap config + Yjs binding reused wholesale (zero CRDT risk — the exact `document-editor.tsx` pipeline runs unmodified) ✓, native toolbar driving TipTap commands ✓, island ↔ Hermes messaging is the slimmed pre-M1 superjson bridge ✓, load-timeout retry + fallback to the native read view ✓ (Done always available).
- Sanctioned cross-package touch (only if needed): optional `onEditorCreate` prop on `DocumentEditor` — additive, web-invisible.
- Known v1 ceilings, all marked: island content styled as web/shadcn until the web Mycel restyle lands; toolbar has no active-state highlighting; node-level edit-role check approximated by workspace role (service enforces authoritatively).
- Biggest risks, in test order: island bundle builds at all (T1 Step 5 gate + tabler-icons contingency), collections-over-bridge preload latency (watch the 30s editor_ready timeout in T3 Step 2), keyboard/viewport behavior (contained to the island screen by design).
