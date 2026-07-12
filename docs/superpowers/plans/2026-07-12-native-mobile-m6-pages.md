# Native Mobile M6 — Page Reading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Native read-only page viewer: opening a page from a space renders its rich-text document (headings, lists, checklists, code, quotes, simple tables, images) as themed RN views, live-updating when the document changes anywhere.

**Architecture:** Mirror the web's document data path exactly: `document.state.get` (base64 Yjs snapshot) + `document.updates.list` (incremental updates) — both live queries with `checkForChanges` — reconstructed via `YDoc` from `@colanode/crdt` (Yjs already ships in the native bundle: `document-service` runs on Hermes), then `buildEditorContent` (`@colanode/client/lib`) → ProseMirror JSON → a new native block renderer. The M3 inline renderer (text+marks) is extracted into a shared module used by both messages and pages. Image file blocks resolve a local `file://` URI via `local.file.get { autoDownload: true }` (live query — the image pops in when the download lands).

**Spec:** `docs/superpowers/specs/2026-07-10-native-mobile-app-design.md` (milestone M6)

## Global Constraints

- Prerequisites: M1–M5 landed. Gates: `npm run compile -w @colanode/mobile`, `npm run test -w @colanode/mobile` (TS6305 → `npx turbo run build --filter=@colanode/ui` once).
- Theme tokens only; Mycel rules; loud `Alert.alert`; `@tiptap/*` type-only; **Hermes has no ES2023 array methods** (`toSorted` etc.) — use `[...arr].sort()`.
- Data facts (verified): a page node's `id` IS its document id. Query `document.state.get` `{ type, documentId, userId }` → `{ id, revision, state: string /* base64 */ } | null`; query `document.updates.list` `{ type, documentId, userId }` → `{ id, documentId, data: string /* base64 */ }[]`; both implement `checkForChanges` (`document.state.updated`, `document.update.created/deleted`). Reconstruction: `new YDoc(state?.state)` then `ydoc.applyUpdate(u.data)` per update (`YDoc` from `@colanode/crdt` accepts base64), content = `buildEditorContent(nodeId, ydoc.getObject())` — same helpers the web `document-editor.tsx` uses; `buildEditorContent`/`mapBlocksToContents` from `@colanode/client/lib`.
- Block/leaf types to render (from `EditorNodeTypes` + editor extensions): `paragraph, heading1, heading2, heading3, blockquote, bulletList, orderedList, listItem, taskList, taskItem (attrs.checked: boolean), codeBlock (attrs.language), horizontalRule, table/tableRow/tableCell/tableHeader, file (attrs.id), mention, hardBreak, text` + marks `bold, italic, underline, strikethrough, code, color, highlight, link`. NOTE: mark names in documents are `strikethrough` (web MarkRenderer handles `strike` — verify actual mark type emitted by the strike extension and support BOTH in the shared mark mapper). Unknown blocks degrade to their plain text.
- Files: query `local.file.get` `{ type, fileId, userId, autoDownload?: boolean }` → `LocalFile | null` with `{ url: string|null, downloadStatus, downloadProgress }`; live (`local.file.created/updated/deleted`). File node metadata (name, subtype, status) from `collections.nodes` by `attrs.id`.

---

### Task 1: Shared inline renderer + native block renderer

**Files:**
- Create: `apps/mobile/src/documents/inline-nodes.tsx` (extracted from message-content)
- Modify: `apps/mobile/src/messages/message-content.tsx` (import the shared part; no behavior change)
- Create: `apps/mobile/src/documents/block-renderer.tsx`
- Create: `apps/mobile/src/documents/file-block-view.tsx`

**Interfaces:**
- Produces: `InlineNodes({ nodes: JSONContent[], palette, textStyle? })` (shared; includes `openLink` with the http(s)-only guard — move it here from message-content); `BlockRenderer({ block: JSONContent, depth?: number })` rendering ANY document block recursively; `FileBlockView({ fileId })`.
- `markStyle` (M3, `apps/mobile/src/messages/mark-style.ts`) moves to `apps/mobile/src/documents/mark-style.ts` (same content + add `strikethrough` as an alias of `strike`, plus `color`/`highlight` marks mapping `attrs` to text/background color pass-through) — update its test imports and add cases:

- [ ] **Step 1: Move + extend mark-style (TDD)** — move `mark-style.ts` + test into `src/documents/`, update the message-content import. Add failing test cases first:

```ts
it('treats strikethrough as strike', () => {
  const { style } = markStyle([{ type: 'strikethrough' }], lightPalette);
  expect(style.textDecorationLine).toBe('line-through');
});

it('passes through color and highlight attrs', () => {
  const { style } = markStyle(
    [
      { type: 'color', attrs: { color: '#ff0000' } },
      { type: 'highlight', attrs: { highlight: '#ffff00' } },
    ],
    lightPalette
  );
  expect(style.color).toBe('#ff0000');
  expect(style.backgroundColor).toBe('#ffff00');
});
```

Run FAIL → implement (switch cases `strikethrough` → same as `strike`; `color`/`highlight` reading `mark.attrs`; verify the ACTUAL attr key names against the web `packages/ui/src/editor/renderers/mark.tsx` before writing) → PASS.

- [ ] **Step 2: Extract `inline-nodes.tsx`** — lift `InlineNodes`, `textOf`, and the guarded `openLink` out of `message-content.tsx` verbatim (message-content keeps `MessageContent` only, importing the shared module). Gates stay green (`npm run test/compile`).

- [ ] **Step 3: Block renderer**

Create `apps/mobile/src/documents/block-renderer.tsx` — a recursive component dispatching on `block.type` (all styling from theme; use `useTheme` + a `createStyles(palette)` factory):

- `paragraph` → `Text` body + `InlineNodes`
- `heading1/2/3` → `Text` with `typeScale.h1/h2/h3`, top margin `spacing.lg/md/md`
- `blockquote` → `View` with `borderLeftWidth: 3, borderLeftColor: palette.accentSoft, paddingLeft: spacing.md`, children recursive
- `bulletList`/`orderedList` → children `listItem`s; marker column: `•` (mono) or `${index + 1}.` — thread `ordered`+index via props
- `taskList` → children `taskItem`s: row with `Ionicons name={checked ? 'checkbox' : 'square-outline'}` (`palette.accent` / `palette.textMuted`) + children; checked items' text `textMuted` + line-through
- `codeBlock` → `View` bg `palette.surface`, `radius.md`, padding `spacing.md`; `Text` with `fonts.mono`, `typeScale.code` size, content = concatenated text leaves (no syntax highlighting — `shortcut:` note: add highlighting later if wanted)
- `horizontalRule` → 1px `palette.border` divider with vertical margin
- `table` → horizontal `ScrollView` wrapping a column of rows; each `tableRow` a flex row of cells (`tableCell`/`tableHeader` → bordered `View` minWidth 120, header cells `fonts.bodyBold` on `palette.surface`); `shortcut:` colspan/rowspan ignored (render as plain grid) — upgrade if real tables demand it
- `file` → `<FileBlockView fileId={block.attrs?.id} />`
- `mention`/`hardBreak`/`text` never appear at block level (inline — handled by `InlineNodes`)
- unknown → `Text` body with the block's flattened text (`textOf`), plus recurse into `.content` if it contains block children — never crash

- [ ] **Step 4: File block view**

`file-block-view.tsx`: react-db `useLiveQuery` findOne on `collections.nodes` by fileId (name/subtype/status as `LocalFileNode`), + Colanode `useLiveQuery({ type: 'local.file.get', fileId, userId, autoDownload: true })`. Render:
- image subtype + `downloadStatus === Completed` + `url` → `<Image source={{ uri: url }} style={{ width:'100%', aspectRatio }} resizeMode="contain">` (aspect from file node attrs if present, else 4/3)
- downloading → surface-colored box with `ActivityIndicator` + caption `${Math.round(progress)}%` in mono
- non-image or no preview → a chip row: `document-attach-outline` icon + file name + subtype caption (tap → `Alert` "Open this file on desktop")
Verify the `DownloadStatus` enum import path and `LocalFileNode` attrs (`subtype`, `mimeType`, size fields) against `packages/client/src/types/files.ts` before writing.

- [ ] **Step 5: Gates + commit**

```bash
npm run test -w @colanode/mobile && npm run compile -w @colanode/mobile
git add apps/mobile/src
git commit -m "feat(mobile): document block renderer — shared inline nodes, blocks, file previews"
```

---

### Task 2: Page screen + document data + spaces dispatch

**Files:**
- Create: `apps/mobile/src/documents/use-document-content.ts`
- Create: `apps/mobile/src/screens/spaces/page-screen.tsx`
- Modify: `apps/mobile/src/navigation/spaces-navigator.tsx` (add `Page: { nodeId: string; title: string }`)
- Modify: `apps/mobile/src/screens/spaces/space-screen.tsx` (`open()`: `page` → navigate Page)

**Interfaces:**
- Produces: `useDocumentContent(nodeId): { blocks: JSONContent[] | null; isPending: boolean }` — the single data hook M7's edit mode will also key off.

- [ ] **Step 1: Data hook**

`use-document-content.ts`:

```ts
import { useMemo } from 'react';

import type { JSONContent } from '@tiptap/core';
import { buildEditorContent } from '@colanode/client/lib';
import { YDoc } from '@colanode/crdt';
import { useCurrentWorkspace } from '@colanode/mobile/session/current-workspace-context';
import { useLiveQuery } from '@colanode/ui/hooks/use-live-query';

export const useDocumentContent = (
  nodeId: string
): { blocks: JSONContent[]; isPending: boolean } => {
  const { workspace } = useCurrentWorkspace();
  const stateQuery = useLiveQuery({
    type: 'document.state.get',
    documentId: nodeId,
    userId: workspace.userId,
  });
  const updatesQuery = useLiveQuery({
    type: 'document.updates.list',
    documentId: nodeId,
    userId: workspace.userId,
  });

  const blocks = useMemo(() => {
    if (stateQuery.isPending || updatesQuery.isPending) return [];
    const ydoc = new YDoc(stateQuery.data?.state);
    for (const update of updatesQuery.data ?? []) {
      ydoc.applyUpdate(update.data);
    }
    const content = buildEditorContent(nodeId, ydoc.getObject());
    return content.content ?? [];
  }, [nodeId, stateQuery.data, stateQuery.isPending, updatesQuery.data, updatesQuery.isPending]);

  return { blocks, isPending: stateQuery.isPending || updatesQuery.isPending };
};
```

Verify against `packages/ui/src/components/documents/document-editor.tsx`'s `buildYDoc`/initial-content code: exact `YDoc` constructor arg (nullable base64), `applyUpdate` arg, `buildEditorContent(nodeId, ydoc.getObject<RichTextContent>())` signature — copy its usage precisely (generics included).

- [ ] **Step 2: Page screen** — `page-screen.tsx`: header = route title; body = `ScrollView` `padding: spacing.md`, `gap: spacing.sm`, page title as `typeScale.h1` (node name from `collections.nodes` findOne), then `blocks.map(block => <BlockRenderer key={block.attrs?.id ?? index} block={block} />)`. Pending → centered `ActivityIndicator`; empty doc → "This page is empty." muted text. No Edit affordance yet (M7 adds it).

- [ ] **Step 3: Wire navigation** — spaces-navigator gains the `Page` screen (title from params); space-screen `open()` gets a `node.type === 'page'` branch navigating to it (before the desktop-stub fallback).

- [ ] **Step 4: Gates + commit**

```bash
npm run test -w @colanode/mobile && npm run compile -w @colanode/mobile
cd apps/mobile && npx expo export --platform ios --output-dir /tmp/expo-export-m6 && cd ../..
git add apps/mobile/src
git commit -m "feat(mobile): native read-only page viewer with live document reconstruction"
```

---

### Task 3: Simulator verification (manual gate, no commit)

Mac workflow as M5 (prebuild --clean if needed; PATH with /usr/local/bin for pod; Metro --clear in tmux; ATS fix for the http test server; Maestro with pinned device + a11y-bounds taps; test session mcp-agent@colanode.test on 100.74.217.116:3001). Test data: pages "Welcome", "Oracle Stub E", "M5 Live Hydration Proof" exist under the Home space; enrich one page from web/desktop or via the colanode MCP (`colanode_update_page`) with: headings, bullet+ordered lists, a checklist with checked/unchecked items, a code block, a quote, a divider, a link, a mention, a small table, and an image attachment if feasible.

- [ ] **Step 1: Build, launch, sign in.**
- [ ] **Step 2: Spaces → Home → tap a page** → native page renders: title h1 (Bricolage), headings hierarchy, list markers, checkboxes (accent checked / muted unchecked), code block in mono on surface, quote with accent border, divider, link (accent, opens Safari), mention (accent @name), table grid. Screenshot(s).
- [ ] **Step 3: Live update** — edit the page from the server side (MCP `colanode_update_page`) while it is OPEN on the sim: content updates in place without navigation (checkForChanges → YDoc rebuild). Screenshot before/after.
- [ ] **Step 4: Image file block** — if an image was attached: placeholder/progress first, then the image appears once `local.file.get` autoDownload completes. If attaching an image is infeasible via available tooling, report environmental for this sub-step only.
- [ ] **Step 5: Unknown-block resilience** — page with a database/embed block (if present) renders its text or is skipped without a crash.
- [ ] **Step 6: Report** + screenshots via SendUserFile.

---

## Self-Review Notes

- Spec coverage (M6): native renderer for headings/paragraphs/marks/lists/checklists/code/quotes/tables/images ✓; "unknown blocks render a labeled placeholder — never crash" ✓ (stronger: flattened text). Live reconstruction beats the spec (updates land while reading).
- Deliberate `shortcut:`s marked in code: no code syntax highlighting; tables ignore colspan/rowspan.
- Risks flagged: exact `YDoc` API usage copied from `document-editor.tsx` (executor verifies); `strikethrough` vs `strike` mark naming (executor verifies against web mark renderer); YDoc-per-render cost is fine at page scale (web does the same on every remote update).
