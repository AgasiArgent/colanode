---
name: triage-sweep
description: One eyes-only triage sweep — fetch new bug reports from the triage ops-API, explode, triage each item with your own judgement, cluster same-root items. Writes ONLY via the ops-API. Never touches code, never posts to chat, never opens PRs.
---

# Triage Sweep (U1 — eyes only)

Environment (required, provided by the cron wrapper): `TRIAGE_OPS_URL` (e.g.
`https://chat.kvotaflow.ru/client/v1/triage/ops`), `TRIAGE_OPS_TOKEN`.
Every call below: `AUTH='Authorization: Bearer '"$TRIAGE_OPS_TOKEN"`.

## Hard rules
- You may call ONLY the ops-API endpoints listed here. No other tools, no file edits, no git, no chat.
- Judgement (triage class, clustering) is yours; all deterministic work (explode) is server-side.
- A project with `killSwitch: true` is skipped entirely.

## Stages

1. **Projects** — `curl -sf -H "$AUTH" "$TRIAGE_OPS_URL/projects"`.
   Skip projects with `"killSwitch": true`. If none remain, print `sweep: no active projects` and stop.

2. **Fetch** — per active project:
   `curl -sf -H "$AUTH" "$TRIAGE_OPS_URL/reports?status=new&projectId=<id>&limit=50"`.
   If every project returns zero reports, print `sweep: nothing new` and stop.

3. **Explode** — per report:
   `curl -sf -X POST -H "$AUTH" "$TRIAGE_OPS_URL/reports/<reportId>/explode"` → its items.

4. **Triage** — per item, decide `bug | feature | unclear | no-fly` from `summary`,
   `sourceRef` (page, sourceFile, selector, comment) and the report's did/expected/got.
   No-fly zones (always `no-fly`, never anything else): auth/permissions/tokens,
   CRDT-sync/schema/migrations, money/calculations, server-infra/deploy, anything
   not provable by a test. Then persist:
   ```
   curl -sf -X PATCH -H "$AUTH" -H 'Content-Type: application/json' \
     "$TRIAGE_OPS_URL/items/<itemId>" \
     -d '{"triage":"bug","triageReason":"<one concrete sentence>","confidence":0.85,"status":"triaged"}'
   ```

5. **Cluster** — within each project, group items whose root cause you judge identical
   (across reports too — two testers, one bug → one cluster). Singleton clusters are
   fine and expected. For every group:
   ```
   curl -sf -X POST -H "$AUTH" -H 'Content-Type: application/json' \
     "$TRIAGE_OPS_URL/clusters" \
     -d '{"projectId":"<id>","rootHypothesis":"<one sentence>","itemIds":["..."],"reason":"<why same root>"}'
   ```

6. **Summary** — print one line per project: `<project>: <reports> reports → <items> items → <clusters> clusters`, plus per-class counts. Stop. (Projection to the board/chat is a later phase — NOT yours.)
