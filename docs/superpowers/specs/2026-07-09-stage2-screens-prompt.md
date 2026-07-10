# Stage 2 prompt — expand the winner (paste into claude.ai/design)

Fill the `[PASTE HERE ...]` block with the winning concept from stage 1.
If you continue in the same claude.ai/design session, replace the block with
"Use concept N from above" instead.

---

# Expand the chosen brand concept across the product (web + iOS)

## Context

[PASTE HERE: the winning concept from stage 1 — product name, logo direction,
full palette (light + dark), typography pairing, motion notes.]

Same product as before: a local-first, self-hosted team workspace
(chat + pages + databases + files), offline-first with a visible,
brand-owned sync state.

## Task A — Web app (desktop viewport, 1440×900)

Design 5 screens in the chosen identity, all inside the same 3-column shell
(icon rail / sidebar / content):

1. **Chat channel** with an open thread panel on the right (the thread holds
   3 replies)
2. **Page editor** — a rich-text document "Q3 launch plan" with headings, a
   checklist, an embedded image and a table; editing toolbar visible
3. **Database — kanban board** "Roadmap": 4 columns (Backlog / In progress /
   Review / Done), cards carrying field chips (assignee avatar, due date,
   priority); board header with a view switcher (Table / Board / Calendar)
   and filters
4. **Inbox** — notification list: mentions, thread replies, invitations;
   clear read/unread states
5. **Login** — the brand moment: logo, email + password, "or continue with
   Google", and a self-hosted server URL field ("Connect to your server")

## Task B — iOS app (native, iPhone 15 Pro frames)

Design 5 screens following Apple HIG patterns (bottom tab bar, large titles,
sheets, swipe actions, context menus) — native feel, yet unmistakably the
same brand. Tab bar: Chats / Spaces / Inbox / Settings.

1. **Chats tab** — conversation list, large title, unread indicators, a swipe
   action revealed on one row
2. **Channel** — chat with the composer above the keyboard, and a long-press
   context menu open on one message (react / reply / copy)
3. **Page** — document reading view with a floating edit affordance
4. **Database board** — kanban adapted to the phone: one column in focus,
   horizontal swipe between columns
5. **Inbox tab** — notifications with a pull-to-refresh hint

## Deliverables

1. All 10 screens.
2. **Design tokens** as a structured list an engineer can copy:
   - Color: full ramp for light + dark in OKLCH — background, surface,
     elevated surface, border, text primary/secondary/muted, accent,
     accent-foreground, semantic success/warning/danger, chat bubble
     own/other, sidebar
   - Type scale: family, size, weight, line-height for display / h1 / h2 /
     h3 / body / caption / code
   - Radius scale, spacing base unit, elevation/shadow levels
   - Motion: durations + easings for micro-interactions (hover/press),
     transitions (panels/sheets), and the signature sync-state animation
3. **Component states** sheet: button (primary / secondary / ghost /
   destructive × default / hover / active / disabled), text input, message
   bubble (own / other / pending-sync), database field chip, tab-bar item
   (active / inactive).

## Constraints

Same as stage 1: WCAG AA contrast, both themes first-class, density-proof
(data tables must stay readable), and every token must be implementable in
Tailwind CSS (web) and React Native StyleSheet (iOS).
