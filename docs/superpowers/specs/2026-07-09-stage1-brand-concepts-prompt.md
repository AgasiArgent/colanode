# Stage 1 prompt — brand concepts (paste into claude.ai/design)

---

# Brand & visual identity concepts for a local-first team workspace

## The product

An open-source, self-hosted, local-first collaboration platform for teams —
one app that replaces the "Slack + Notion" pair:

- **Chat**: real-time channels & DMs, threads, emoji reactions, mentions
- **Pages**: rich-text collaborative documents (Notion-class editor)
- **Databases**: custom fields, table / kanban / calendar views
- **Files & folders**

Everything is offline-first: data lives in a local database on the device and
syncs conflict-free (CRDT) to a server the team hosts themselves. Privacy and
ownership are the core promise — your data never touches someone else's cloud.

## Audience

Small technical teams, startups, self-hosting enthusiasts, privacy-conscious
orgs (agencies, labs, communities). People who deliberately run their own
server — independent, a bit contrarian, allergic to corporate SaaS.

## Where we are today (anti-reference)

The current UI is an untouched default shadcn/ui theme: grayscale, near-black
primary buttons, default radii and shadows, system font. Clean but completely
anonymous — it looks like a thousand other apps. That is exactly what we are
escaping.

## Your task

Propose **4 radically different brand concepts**. Not four shades of one idea —
four different worlds. For each concept deliver:

1. **Product name** — short (1–2 syllables preferred), pronounceable in any
   language, plausible as an App Store title and a domain-style handle.
   Explain the story behind it. The name must belong to the concept's world.
2. **Logo direction** — described and sketched (a simple mark is fine).
3. **Color system** — light AND dark theme: background/surface ramp, primary
   accent, semantic colors (success / warning / danger), chat-bubble colors.
   Both themes get equal care — don't design light and invert it.
4. **Typography** — display + body pairing with a type-scale sample. No
   Inter-because-it's-safe: pick faces that carry the concept's personality
   (open-license faces preferred).
5. **Motion & texture** — how the interface feels: transitions, hover states,
   and one signature moment (e.g. how the sync/offline state is visualized).
6. **One hero screen** — the web app's chat view, fully designed in this
   concept (content spec below).
7. One sentence: *"This concept will attract users who ___."*

## Hero screen content spec (use this real content, no lorem)

A 3-column workspace shell, desktop viewport:

- **Narrow icon rail**: Chats / Spaces / Inbox / Settings icons, one carrying
  an unread badge "3"
- **Sidebar**: workspace "Northwind Labs"; a "Design" space expanded showing
  channels `#general`, `#design-crit` (active), `#releases`, a page
  "Brand guidelines", and a database "Roadmap"
- **Main column**: channel `#design-crit`, header topic "Weekly crit — be
  kind, be specific"; 6–8 messages from 4 people (avatars, names,
  timestamps), one threaded reply showing "4 replies", one emoji-reaction
  cluster, one image attachment; message composer at the bottom
- One subtle but visible element showing sync state:
  *"All changes saved locally · synced 12s ago"* — this is a brand moment,
  make it ownable.

## Hard constraints

- The language must scale to a **dense product**: the same identity must
  survive data tables, kanban boards and a rich-text editor — not only an
  airy chat. Show restraint where density demands it.
- Light + dark themes are both first-class.
- WCAG AA contrast for text.
- Web implementation is Tailwind CSS design tokens; iOS will be a native app
  sharing the identity. Nothing that only works as a static picture.

## Explicitly forbidden (the generic-AI look)

- Purple-to-blue gradients on white; a lone acid-green accent on near-black
- Inter or Space Grotesk as "the safe choice"
- The default shadcn/ui look, rounded-lg on everything
- Emoji as section markers, glassmorphism-by-default

## Axes to explore (suggestions, not a menu)

Pick your own four worlds. Starting vectors to mix or discard:

- **Organic network** — mycelium, root systems, bioluminescence; local-first
  as a living distributed organism
- **Concrete & stencil** — brutalist; self-hosting as a bunker; data
  sovereignty; bold industrial type
- **Terminal heritage** — hacker/monospace roots, phosphor accents —
  modernized, not cosplayed
- **Editorial print** — the workspace as a well-set magazine: strong grid,
  serif display, ink on paper
