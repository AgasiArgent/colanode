# Mycel Web Restyle — PR 2 (Chat Pixel Pass) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the chat surfaces (composer, thread panel, rail, channel identity, reaction chips, thread indicator, file cards, avatar fallbacks) pixel-close to the Mycel reference screen `ui_kits/web/index.html`.

**Architecture:** Pure presentation pass on `packages/ui` components using the token utilities shipped in PR 1 (`bg-card`, `bg-rail`, `bg-primary-soft`, `bg-spore`, `font-mono`, `font-display`, radius scale sm/md/lg/xl = 8/12/16/20px). One small token addition (`--border-strong`). One small plumbing addition (composer placeholder prop). Branch `mycel-pr2-chat-pixel-pass` is stacked on `worktree-web-mycel-restyle` (PR 1); the draft PR targets that branch as base.

**Tech Stack:** React 19, Tailwind v4, TipTap (composer), vitest.

**Spec:** `docs/superpowers/specs/2026-07-10-web-mycel-restyle-design.md` §6.

## Global Constraints

- Work in the worktree root `/Users/andreynovikov/workspace/colanode/.claude/worktrees/web-mycel-restyle`, on branch `mycel-pr2-chat-pixel-pass` (Task 1 Step 0 creates it from `worktree-web-mycel-restyle`).
- Gates for every commit: `npx turbo run build --filter=@colanode/ui^... && npm run compile -w @colanode/ui && npm run test -w @colanode/ui && npm run test -w @colanode/web` — all pass.
- Radius utilities are remapped: `rounded-sm`=8px, `rounded-md`=12px, `rounded-lg`=16px, `rounded-xl`=20px. Use them; use arbitrary `rounded-[14px]` only where the design says 14px (cards inside messages, rail tiles).
- Copy values verbatim from this plan (design contract). Hover washes stay neutral (`bg-accent`/`bg-sidebar-accent`), brand green only via `primary` tokens.
- Sentence case for copy; mono (`font-mono`) only for system state: timestamps, `#` marks, `⏎ send`, file meta, uppercase section labels.
- Do not touch `apps/mobile` or anything outside the files each task names. Preserve every `data-testid`, `aria-*` attribute and behavior (queries, handlers) — this is a restyle.

---

### Task 1: Branch + composer card + placeholder plumbing

**Files:**
- Modify: `packages/ui/src/components/messages/message-create.tsx`
- Modify: `packages/ui/src/components/messages/message-editor.tsx:34-42,64-66`

**Interfaces:**
- Produces: `MessageEditorProps.placeholder?: string` (optional; default `'Write a message'`). No other task depends on this.

- [ ] **Step 0: Create the stacked branch**

```bash
git switch -c mycel-pr2-chat-pixel-pass
```

- [ ] **Step 1: Add the `placeholder` prop to `MessageEditor`**

In `message-editor.tsx`: add `placeholder?: string;` to `MessageEditorProps` (after `rootId`); destructure it in the component's props; change the extension config to:

```typescript
        PlaceholderExtension.configure({
          message: placeholder ?? 'Write a message',
        }),
```

If the editor's extensions array is built inside a memo/closure that lists dependencies, add `placeholder` to those dependencies; if it is created once per mount, leave as is (the composer remounts per conversation via `key={conversation.id}`).

- [ ] **Step 2: Compute the placeholder in `MessageCreate` and restyle the card**

In `message-create.tsx`:

a) Add imports: `eq, useLiveQuery` from `@tanstack/react-db` (top import block).

b) Inside the component (after `const conversation = useConversation();`), fetch the conversation node name:

```typescript
  const conversationNodeQuery = useLiveQuery(
    (q) =>
      q
        .from({ nodes: workspace.collections.nodes })
        .where(({ nodes }) => eq(nodes.id, conversation.id))
        .findOne(),
    [workspace.userId, conversation.id]
  );

  const conversationNode = conversationNodeQuery.data;
  const channelName =
    conversationNode?.type === 'channel'
      ? ((conversationNode.attributes as { name?: string } | undefined)?.name ??
        null)
      : null;
  const placeholder = conversation.isThread
    ? 'Reply in thread'
    : channelName
      ? `Message #${channelName}`
      : 'Write a message';
```

Note: check how other components read a channel's name from a `LocalNode` (e.g. `channel-sidebar-item.tsx` uses `channel.name` on `LocalChannelNode`). If the query returns typed `LocalNode` where `nodes.name` is available directly, use `conversationNode.name` instead of the attributes cast — match the codebase's existing accessor, do not invent one.

c) Pass it to the editor: `<MessageEditor ... placeholder={placeholder} />`.

d) Restyle the card row. Replace:

```tsx
      <div className="flex min-h-0 flex-row items-center rounded bg-muted p-2 pl-0">
```

with:

```tsx
      <div className="flex min-h-0 flex-row items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
```

e) The attachment trigger: replace the `<div className="flex w-10 items-center justify-center">` wrapper's content styling — the wrapper div becomes `<div className="flex size-8 shrink-0 items-center justify-center">` and the `DropdownMenuTrigger` gets `className="flex size-8 cursor-pointer items-center justify-center rounded-md text-primary hover:bg-accent"` (was `cursor-pointer hover:bg-accent`). Keep `aria-label="Add attachment"` and the disabled logic.

f) The send affordance: in the right-hand actions div, add a mono hint before the button and recolor the active state. Replace the actions block with:

```tsx
        <div className="flex flex-row items-center gap-2">
          <span className="hidden select-none font-mono text-[11px] text-muted-foreground/70 sm:inline">
            ⏎ send
          </span>
          {isPending ? (
            <Spinner size={20} />
          ) : (
            <button
              type="submit"
              aria-label="Send message"
              data-testid="message-composer-send"
              aria-disabled={!(conversation.canCreateMessage && hasContent)}
              className={`${
                conversation.canCreateMessage && hasContent
                  ? 'cursor-pointer text-primary'
                  : 'cursor-default text-muted-foreground'
              }`}
              onClick={handleSubmit}
            >
              <Send size={20} />
            </button>
          )}
        </div>
```

- [ ] **Step 3: Gates**

Run the Global Constraints gate chain. Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/components/messages/message-create.tsx packages/ui/src/components/messages/message-editor.tsx
git commit -m "feat(ui): Mycel composer card with contextual placeholder and mono send hint"
```

---

### Task 2: Thread panel chrome

**Files:**
- Modify: `packages/ui/src/components/layouts/thread-panel.tsx:22,38-39`

- [ ] **Step 1: Restyle panel surface and header**

- Resizable className: `'border-l border-border bg-background'` → `'border-l border-border bg-sidebar'`.
- Header row div: `'flex h-10 shrink-0 flex-row items-center justify-between border-b border-border px-3'` → `'flex h-12 shrink-0 flex-row items-center justify-between border-b border-border px-4'`.
- Title: `<p className="text-sm font-semibold">Thread</p>` → `<p className="font-display text-[15px] font-bold">Thread</p>`.
- Close button: unchanged.

- [ ] **Step 2: Gates + commit**

```bash
git add packages/ui/src/components/layouts/thread-panel.tsx
git commit -m "feat(ui): Mycel thread panel chrome"
```

---

### Task 3: Icon rail

**Files:**
- Modify: `packages/ui/src/components/layouts/sidebars/sidebar-menu.tsx:52`
- Modify: `packages/ui/src/components/layouts/sidebars/sidebar-menu-icon.tsx:29-41`

- [ ] **Step 1: Rail background**

In `sidebar-menu.tsx` line 52: `'flex flex-col h-full w-[65px] min-w-[65px] items-center'` → `'flex flex-col h-full w-[65px] min-w-[65px] items-center bg-rail'`.

- [ ] **Step 2: Rail tiles**

In `sidebar-menu-icon.tsx` replace the button/icon classes:

```tsx
      className={cn(
        'size-11 flex items-center justify-center cursor-pointer hover:bg-sidebar-accent rounded-[14px] relative',
        className,
        isActive ? 'bg-sidebar-accent' : ''
      )}
```

and the icon:

```tsx
      <Icon
        className={cn(
          'size-5',
          isActive ? 'text-primary' : 'text-muted-foreground'
        )}
      />
```

(`bg-sidebar-accent` is already Mycel `--accent-soft` — the green nav pill; only size, radius, and active icon color change.)

- [ ] **Step 3: Gates + commit**

Note: `sidebar-menu.test.tsx` asserts accessible names — behavior untouched, it must still pass.

```bash
git add packages/ui/src/components/layouts/sidebars/sidebar-menu.tsx packages/ui/src/components/layouts/sidebars/sidebar-menu-icon.tsx
git commit -m "feat(ui): Mycel icon rail — rail background, 44px tiles, accent active icon"
```

---

### Task 4: Channel `#` identity + sidebar section labels

**Files:**
- Modify: `packages/ui/src/components/channels/channel-sidebar-item.tsx:44-49`
- Modify: `packages/ui/src/components/channels/channel-breadcrumb-item.tsx`
- Modify: `packages/ui/src/components/layouts/sidebars/sidebar-header.tsx:14`

- [ ] **Step 1: Channel rows — mono `#` instead of the default icon**

In `channel-sidebar-item.tsx`, replace the `<Avatar ... />` element with:

```tsx
          {channel.avatar ? (
            <Avatar
              id={channel.id}
              avatar={channel.avatar}
              name={channel.name}
              className="size-4 shrink-0"
            />
          ) : (
            <span
              aria-hidden="true"
              className={cn(
                'w-4 shrink-0 text-center font-mono text-sm leading-none',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              #
            </span>
          )}
```

(`isActive` is already in scope from the Link render prop; `cn` is already imported.)

- [ ] **Step 2: Channel breadcrumb — accent `#` + display-font name**

Replace the body of `channel-breadcrumb-item.tsx`:

```tsx
import { LocalChannelNode } from '@colanode/client/types';

interface ChannelBreadcrumbItemProps {
  channel: LocalChannelNode;
}

export const ChannelBreadcrumbItem = ({
  channel,
}: ChannelBreadcrumbItemProps) => {
  return (
    <div className="flex cursor-pointer items-center gap-1.5">
      <span
        aria-hidden="true"
        className="font-mono text-sm font-medium text-primary"
      >
        #
      </span>
      <span className="font-display text-[15px] font-bold text-foreground">
        {channel.name}
      </span>
    </div>
  );
};
```

(The generic `BreadcrumbItem` stays untouched for all other node types. If `channel.avatar` is set, the custom avatar is intentionally not shown in the breadcrumb — the `#` is the channel mark per the reference. If other places compose `ChannelBreadcrumbItem` with separators/click handlers, they keep working — the wrapper div is presentational.)

- [ ] **Step 3: Sidebar section labels — uppercase mono**

In `sidebar-header.tsx` line 14: `'font-bold text-muted-foreground grow app-no-drag-region'` → `'font-mono text-[11px] font-medium uppercase tracking-[1.2px] text-muted-foreground grow app-no-drag-region'`.

- [ ] **Step 4: Gates + commit**

```bash
git add packages/ui/src/components/channels/channel-sidebar-item.tsx packages/ui/src/components/channels/channel-breadcrumb-item.tsx packages/ui/src/components/layouts/sidebars/sidebar-header.tsx
git commit -m "feat(ui): mono channel # marks, display-font channel header, mono section labels"
```

---

### Task 5: `--border-strong` token + reaction chips

**Files:**
- Modify: `packages/ui/src/lib/themes.ts` (one line per theme)
- Modify: `packages/ui/src/lib/themes.test.ts` (extend two assertions)
- Modify: `packages/ui/src/styles/globals.css` (one `@theme` line)
- Modify: `packages/ui/src/components/messages/message-reaction-counts.tsx:96-99`

- [ ] **Step 1: Failing test first (TDD for the token)**

In `themes.test.ts` add to the light test: `expect(vars['--border-strong']).toBe('#B9C4BC');` and to the dark test: `expect(vars['--border-strong']).toBe('#2E5A46');`
Run: `npm run test -w @colanode/ui -- themes` → FAIL (property undefined).

- [ ] **Step 2: Add the token**

In `themes.ts`: add `'--border-strong': '#B9C4BC',` after `--border` in `lightVariables`, and `'--border-strong': '#2E5A46',` after `--border` in `darkVariables` (values verbatim from the design contract's `--border-strong`).
In `globals.css` `@theme inline`, after `--color-border: var(--border);` add: `--color-border-strong: var(--border-strong);`
Run: `npm run test -w @colanode/ui -- themes` → PASS.

- [ ] **Step 3: Restyle reaction chips**

In `message-reaction-counts.tsx` replace the button `className` (fixes the `rouded` typo, removes the shadow):

```tsx
              className={cn(
                'flex cursor-pointer flex-row items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs transition-colors',
                hasReacted
                  ? 'border-border-strong bg-primary-soft text-primary-soft-foreground'
                  : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
```

Keep `data-testid`, `aria-pressed`, `aria-label`, the `EmojiElement` and count span unchanged.

- [ ] **Step 4: Gates + commit**

```bash
git add packages/ui/src/lib/themes.ts packages/ui/src/lib/themes.test.ts packages/ui/src/styles/globals.css packages/ui/src/components/messages/message-reaction-counts.tsx
git commit -m "feat(ui): border-strong token and Mycel reaction chips"
```

---

### Task 6: Thread indicator pill

**Files:**
- Modify: `packages/ui/src/components/messages/message-thread-indicator.tsx:71-84`

- [ ] **Step 1: Restyle the pill**

Replace the button `className` and the unseen dot:

```tsx
      className={cn(
        'mt-1 inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-1 text-xs text-primary-soft-foreground transition-colors hover:bg-primary-soft/80'
      )}
```

- Unseen dot: `'size-1.5 rounded-full bg-blue-500'` → `'size-1.5 rounded-full bg-spore'` (keep `aria-label="unseen replies"`).
- Unseen count emphasis: `cn(hasUnseen && 'font-semibold text-foreground')` → `cn('font-medium', hasUnseen && 'font-bold')` (color comes from the pill's soft foreground now).
- Timestamp: `<span>{timeAgo(latestReply.createdAt)}</span>` → `<span className="font-mono text-[10px] opacity-80">{timeAgo(latestReply.createdAt)}</span>`.

- [ ] **Step 2: Gates + commit**

```bash
git add packages/ui/src/components/messages/message-thread-indicator.tsx
git commit -m "feat(ui): Mycel thread indicator pill with spore unseen dot"
```

---

### Task 7: File attachment cards

**Files:**
- Modify: `packages/ui/src/components/files/file-block.tsx:43-57`

- [ ] **Step 1: Restyle both card variants**

Preview variant — wrap with a bordered card:

```tsx
        <div className="flex h-72 max-h-72 w-full max-w-lg cursor-pointer items-center justify-center overflow-hidden rounded-[14px] border border-border p-2 hover:bg-muted/50">
          <FilePreview file={file} />
        </div>
```

Non-preview variant — bordered card with mono meta line:

```tsx
        <div className="flex w-full max-w-md cursor-pointer flex-row items-center gap-3 overflow-hidden rounded-[14px] border border-border bg-card p-3 hover:bg-accent">
          <FileIcon mimeType={file.mimeType} className="size-10" />
          <div className="flex min-w-0 flex-col gap-1">
            <div className="truncate text-sm font-medium">{file.name}</div>
            <div className="font-mono text-[11px] text-muted-foreground">
              {file.mimeType}
            </div>
          </div>
        </div>
```

(The reference shows `name · size` in the meta line; the node's size field availability varies — if `file.attributes.size` or `file.size` exists as a number on `LocalFileNode`, render `{file.mimeType} · {formatBytes(size)}` using an existing byte-format helper if one exists in `packages/ui/src/lib` (search `formatBytes|humanFileSize`); if no such helper exists, leave mimeType only — do NOT write a new formatter for this.)

- [ ] **Step 2: Gates + commit**

```bash
git add packages/ui/src/components/files/file-block.tsx
git commit -m "feat(ui): Mycel file attachment cards with mono meta"
```

---

### Task 8: Avatar fallback palette

**Files:**
- Modify: `packages/ui/src/lib/avatars.ts:31-46`
- Modify: `packages/ui/src/components/avatars/avatar-fallback.tsx`

**Interfaces:**
- Produces: `getColorForId(id: string): { background: string; foreground: string }` — SHAPE CHANGE. Every consumer must be updated in this task.

- [ ] **Step 1: Find all consumers**

Run: `grep -rn "getColorForId" packages/ui/src apps/ --include=*.ts --include=*.tsx`
Update every hit to the new shape in Step 3 (the known one is `avatar-fallback.tsx`; if others exist, apply `color.background` where a single color was used, and report any non-obvious case in your report instead of guessing).

- [ ] **Step 2: Replace the palette**

In `avatars.ts`, replace the `colors` array and `getColorForId`:

```typescript
export interface AvatarColor {
  background: string;
  foreground: string;
}

// Mycel muted avatar tones (from the reference screen): dark-soil background
// with a pale tinted foreground. Deterministic per id, readable on both themes.
const colors: AvatarColor[] = [
  { background: '#2E4A3C', foreground: '#B9E4CD' }, // moss
  { background: '#3C2E4A', foreground: '#D3B9E4' }, // plum
  { background: '#4A3C2E', foreground: '#E4D3B9' }, // ochre
  { background: '#2E404A', foreground: '#B9D6E4' }, // steel
  { background: '#4A2E33', foreground: '#E4B9C0' }, // clay
  { background: '#3E4A2E', foreground: '#D3E4B9' }, // lichen
];

export const getColorForId = (id: string): AvatarColor => {
  const index = Math.abs(hashCode(id)) % colors.length;
  return colors[index]!;
};
```

- [ ] **Step 3: Update `avatar-fallback.tsx`**

```tsx
  const color = getColorForId(id);
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center overflow-hidden rounded',
        getAvatarSizeClasses(size),
        className
      )}
      style={{ backgroundColor: color.background, color: color.foreground }}
    >
      <span className="font-medium">{char}</span>
    </span>
  );
```

(Drops `text-white` and `shadow`. The `rounded` shape is intentionally unchanged — full-round user avatars are a PR 3 decision.)

- [ ] **Step 4: Gates + commit**

```bash
git add packages/ui/src/lib/avatars.ts packages/ui/src/components/avatars/avatar-fallback.tsx
git commit -m "feat(ui): Mycel muted avatar fallback palette"
```

(Include any other consumer files updated in Step 1.)

---

### Task 9: Visual verification + stacked draft PR

**Files:** none.

- [ ] **Step 1: Full gates** (Global Constraints chain) — all pass.

- [ ] **Step 2: Visual smoke** — `cd apps/web && npm run dev`, screenshot both themes (login screen renders composer-free; if no live workspace is available, verify via the running app what is reachable and rely on review for the rest). Check: no green hover washes, mono marks render in Spline Sans Mono, chips/pills use soft green only for own/active states.

- [ ] **Step 3: Push + draft PR stacked on PR 1**

```bash
git push -u origin mycel-pr2-chat-pixel-pass
gh pr create --draft --base worktree-web-mycel-restyle --title "feat(ui): Mycel chat pixel pass (restyle PR 2/3)" --body "..."
```

(PR body: summary of the eight surfaces, spec/plan links, gate checklist, note that base is PR 1's branch and it must merge first.)

---

## Self-review notes

- Spec §6 coverage: composer → T1; thread panel → T2; rail → T3; channel header + `#` + section labels (moved from PR 1) → T4; reaction chips → T5; file cards → T7; thread indicator → T6; avatar palette → T8. Deferred within PR 2, documented: composer `+` dropdown contents unchanged (restyle only); thread indicator avatar stack from the reference omitted (needs author-avatar fetch — noted as simplification, revisit in PR 3 if wanted); breadcrumb `#` shown even when a channel has a custom avatar (channel mark per reference).
- Type consistency: `MessageEditorProps.placeholder` optional with `?? 'Write a message'` default (T1 only); `AvatarColor` shape change confined to T8 with a mandatory consumer grep; `--border-strong` values match the contract file (`#B9C4BC`/`#2E5A46`).
- No placeholders: every step carries exact code or an explicit bounded fallback rule (T1 name accessor, T7 size helper, T8 unknown consumers → report, don't guess).
