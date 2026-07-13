# Native Mobile — Phase 2 design (with a phase 3 outlook)

Date: 2026-07-12
Follows: `2026-07-10-native-mobile-app-design.md` (phase 1, M1–M7 — shipped in PR #21)

## Goal

Take the native app from "works on my simulator" to "shipped, branded, and at
feature parity with desktop". Phase 2 closes the product gaps (files, search,
databases, reactions) and the debts phase 1 knowingly left (rebrand, polish,
server-side notification previews, CI regression coverage, Android).

Phase 3 (directional, at the end of this document) covers what comes after
parity — the mobile-native moments, the agent surface, scale, accessibility and
iPad. It is specced coarsely on purpose: real TestFlight feedback should be
allowed to reorder it.

## Decisions locked during brainstorming

| Question | Decision |
| --- | --- |
| Scope | All three goals (releasability, parity, debts) are in phase 2 — split into sub-phases, executed back-to-back |
| Order | **Releasability first** (2A) → feature parity (2B) → Android (2C). Ship to real users early, gather feedback while the heavy features are built |
| Rebrand depth | **Whole repository** — mobile, web, desktop, server emails, README. Accepted cost: the fork diverges further from upstream Colanode |
| Server changes | **Yes** — the empty `notification.preview` is fixed server-side (benefits every client, not just mobile) |
| Android | Phase **2C**, after iOS ships |

## Milestones

### Phase 2A — releasability

- **M8 Rebrand to Mycel (whole repo).** Product name, logo mark (SVG from the
  design project), app icon, splash, iOS bundle id, package names, README,
  server email templates. Deliberately early: it touches everything, and the
  cost only grows. **Known consequence:** changing the bundle id makes the app
  a fresh install — existing simulator/TestFlight data does not migrate.
  Acceptable at this stage; called out so nobody is surprised.
- **M9 Polish what exists.** Message reactions (mutations exist —
  `node.reaction.create/delete`; needs a long-press picker + reaction-cluster
  rendering); foreground notification toasts (port the web
  `InAppNotificationToaster` logic: seen-set diff, freshness window,
  suppression when the same conversation is open — the web version is
  router/sonner-coupled, so the logic is ported, not the component); editor
  toolbar active states (island reports selection state outward over the
  bridge); Inbox pagination. Also folds in the node-level edit-role check the
  M7 plan approximated with the workspace role.
- **M10 Server: notification previews.** Populate `notifications.preview` at
  creation (message text + channel name). The extraction logic already exists
  in `apps/server/src/services/push-service.ts` (`extractBlockTexts`) but is
  not reused by `notification-service.ts`. Fixes empty Inbox rows on **all**
  clients.
- **M11 CI regression suite.** Maestro flows in GitHub Actions: sign in → send
  a message → open a page → edit it. The testIDs are already in place across
  the app. Also makes the editor-island bundle build a CI step (today it is a
  manual step every simulator run tripped over).
- **M12 TestFlight.** EAS production profile, production APNs certificates,
  store screenshots, privacy manifest → a build in real hands.

### Phase 2B — feature parity

- **M13 Files and folders.** Folder browser, file previews, and **upload from
  the phone** (camera/gallery via `expo-image-picker`; the client upload
  service already exists and speaks tus). First in 2B: it is what people
  expect from a phone, and it is cheaper than databases.
- **M14 Search.** Messages and nodes (`user.search` and node search already
  exist in the client layer).
- **M15 Databases — read.** Table and board (kanban) views in read-only mode,
  field chips, filters/sorts from saved views.
- **M16 Databases — write.** Create/edit records, change field values.

Databases are split read/write on purpose: they are two different risk
profiles, and after M15 the product is already useful (check the roadmap from
your phone) even if M16 slips.

### Phase 2C — Android

- **M17 Android.** FCM push (the server needs a second push channel alongside
  APNs), a full screen sweep in the emulator, Play listing. Expect
  platform-specific gotchas here (back button, edge-to-edge).

### Phase 3 — beyond parity (directional)

Phase 3 is deliberately specced at a coarser grain: it starts once the app is
in real hands, and TestFlight feedback should be allowed to reorder it. Each
milestone below gets its own brainstorm → spec → plan cycle when it is reached;
what follows is the intent, not a contract.

- **M18 Mobile-native moments.** The things a phone does that a desktop cannot,
  and which the phase-1/2 work deliberately skipped: share-sheet ingest (send a
  photo/link from any app straight into a channel), notification quick-reply,
  Siri/Shortcuts intents ("send a message to #design"), Live Activities or a
  home-screen widget for unread state. Rationale: these — not feature parity —
  are what make people keep the app installed.
- **M19 Agent surface.** The repo already carries an MCP server and a bot
  account (`apps/colanode-bot`, the `colanode` MCP). Mobile is the natural
  place to talk to an agent about your workspace. Design constraint from the
  house rules: the agent is a first-class user of the SAME operations layer the
  UI uses (`app.mediator`) — no parallel API, writes stay allowlisted, reads
  collapse behind a catalog. Scope to be pinned in its own brainstorm.
- **M20 Scale and performance.** The known ceilings phase 1 marked with
  `shortcut:` comments come due here: `notification.list` has no pagination,
  `sortSpaceChildren` is O(n log n) per render, the editor island rebuilds the
  whole YDoc on every remote update, tables ignore colspan/rowspan, code blocks
  have no syntax highlighting. Also: per-root synchronizer memory pressure on
  large workspaces (already flagged in the repo's own CLAUDE.md).
- **M21 Accessibility and internationalization.** VoiceOver sweep (the testIDs
  are in place, accessible names are not audited), Dynamic Type support (the
  type scale is currently fixed px), RTL layout, and extraction of UI copy —
  the app is English-only with strings inline.
- **M22 iPad.** `supportsTablet` is already true in `app.json` but nothing is
  designed for it: the 3-column desktop shell has an obvious tablet analogue
  (rail + list + content), and the M7 island would benefit from the extra room.

Ordering within phase 3 is intentionally unresolved: M18 is the bet on
retention, M20 is the bet on trust. Which comes first should be decided by what
TestFlight users actually complain about.

## Out of scope (with reasons)

- **Mycel styling inside the editor island** — not a milestone. It arrives for
  free when the web restyle lands (`packages/ui` → Mycel tokens; that track is
  already handed off to a separate session). Styling the island separately
  would be work thrown away days later.
- **Workspace creation on mobile** — desktop/web only, as in phase 1.
- **Offline conflict UX** — CRDTs already merge silently; no user-facing
  conflict flow is planned.

## Process

Unchanged from phase 1, because it worked: per milestone — a plan with
complete code → the pipeline (Opus implementer → 3 adversarial reviewers →
fix cycles until clean) → **live verification in the iOS simulator against the
test server**. The simulator gate caught five defects in phase 1 that neither
`tsc` nor the web app can see (Hermes missing ES2023 array methods, DOM-only
ProseMirror pulled in by a value import, two island mount crashes) — it stays.

Execution order: M8 → M9 → M10 → M11 → M12 → (release) → M13 → M14 → M15 →
M16 → M17.
