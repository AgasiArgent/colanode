# Triage engine → lenovo migration + near-realtime triage into Linear

**Date:** 2026-07-20
**Status:** Design approved (brainstorm), pending implementation plan
**Author:** Andrey + Claude
**Repo (engine):** `AgasiArgent/colanode` (fork), checkout `~/triage-brain`

---

## 1. Problem & goal

Today the pin bug-report pipeline is: kvota prod (`app.kvotaflow.ru`) forwards each
feedback to `POST /client/v1/triage/ingest` on the engine (Colanode fork) running
on **dd** (`chat.kvotaflow.ru`); ingest does a **dumb INSERT** (`triage_reports.status='new'`);
all intelligence happens later in a **cron sweep every 3 hours** (Claude agent →
`triage-sweep` skill → ops gateway) that explodes, triages, clusters/dedups, and
deterministically projects each cluster into a **Linear issue**.

Two problems:

1. **Latency** — a bug can sit up to 3 hours before it appears in Linear. The
   owner wants near-realtime: each feedback surfaces as a Linear issue within
   ~1 minute so incoming issues are visible as they happen.
2. **Stale placement** — the engine lives on dd purely as a leftover from when the
   Colanode UI was hosted there. The Colanode web UI is **retired** (humans now
   work in **Linear**), the sweep agent already runs on **lenovo**, yet the server
   sits on dd — an awkward cross-machine split. Consolidating onto lenovo makes the
   realtime trigger trivial (co-located) and removes the leftover.

**End state:** engine runs on lenovo; each feedback becomes a diagnosed Linear
issue within ~1 minute; the redundant per-bug Telegram DM (kvota side) is turned
off once realtime Linear is proven; `chat.kvotaflow.ru` and the dormant CI
auto-fix bug-loop are retired.

### Non-goals
- No change to triage/dedup *logic* — same Claude sweep, same LLM-semantic
  clustering over compact candidate summaries (no embeddings introduced).
- No change to the Linear annotation *content or behavior* — the sweep already
  never sets/changes the Linear workflow state (confirmed: `ensureIssue` sends
  only `{teamId,title,description,labelIds}`, `updateIssueDescription` sends only
  `{description}`; issues are created in the team's default stage). The
  `## Next step (human gate)` text block stays as-is. Moving to "Approved for fix"
  remains a purely human action.
- No auto-fix. The GitHub auto-fix bug-loop is retired, not migrated (see §6).

---

## 2. Current-state facts (verified 2026-07-20)

### Engine on dd
- Compose: `/home/anton/colanode/docker-compose.prod.yml` (user `anton`, **not** root).
  Runtime config `./config.json`, secrets `./.env` (mode 600, backup `.env.bak-pre-u1`),
  `./apns-auth-key.p8`.
- Containers (4): `colanode_server` (`colanode-server:dd`, no published ports — reached
  via dd Caddy `rachel-helper_default` → `chat.kvotaflow.ru`), `colanode_web`
  (`colanode-web:dd`, retired UI), `colanode_redis` (`redis:7-alpine`, `--requirepass`,
  internal only), and the **shared** `supabase-db` (`supabase/postgres:15.8.1.085`)
  hosting DB `colanode` **as a co-tenant** alongside `rachel_mailer` + `_supabase`.
- Named volumes: `server_storage` (`/var/lib/colanode/storage` — screenshot/video
  artifacts), `redis_data`.

### DB `colanode`
- Size **11 MB**; rows: `triage_reports=54`, `triage_items=73`, `triage_clusters=51`.
- Extensions required: **`vector` (pgvector)** only — `CREATE EXTENSION IF NOT EXISTS vector`
  (migration `00017`). `gen_random_uuid()` is core PG13+. No `uuid-ossp`, no extra schemas,
  no RLS, no custom roles beyond owner `colanode`.
- Config read via `env://POSTGRES_URL` (`apps/server/src/lib/config/postgres.ts`) and
  `env://REDIS_URL` (`…/redis.ts`).
- **No dedicated backup exists on dd** — a manual `pg_dump -Fc colanode` is required
  before migration.

### Redis is **not** optional
- BullMQ `Queue`+`Worker` (`services/job-service.ts` — background jobs incl. explode),
  pub/sub event-bus (`lib/event-bus.ts`, `redis.duplicate().subscribe(eventsChannel)`),
  realtime sockets (`services/socket-service.ts`), rate-limits, OTPs, TUS upload
  locks/kv, push-service. **The server will not boot without Redis; ingest+sweep
  depend on it.** Migration must include a Redis for the engine on lenovo.

### URLs / config (not hardcoded for the hot paths)
- Ingest target: `config.json` `web.domain=chat.kvotaflow.ru`, `cors.origin=https://chat.kvotaflow.ru`.
  kvota prod stores its ingest URL in `/root/onestack/.env` on kvota-new (one var).
- Per-project ingest token lives in DB column `triage_projects.ingest_token` (UNIQUE),
  **not** in env (`apps/server/src/api/client/plugins/triage-ingest-auth.ts:44`).
- Sweep ops endpoint: **not** hardcoded — read from `~/.config/triage/env` on lenovo:
  `TRIAGE_OPS_URL=https://chat.kvotaflow.ru/client/v1/triage/ops`, `TRIAGE_OPS_TOKEN=…`,
  `BUG_LOOP_ENABLED=true`. Consumers: `scripts/triage-ops.sh`, `scripts/triage-sweep-cron.sh`,
  `apps/colanode-bot/src/{triage-config.ts,linear/config.ts,linear/ops-client.ts}`.
- Hardcoded `chat.kvotaflow.ru`: `scripts/deploy-dd.sh:11`, `scripts/rollback-dd.sh:9`
  (health-check), and CI bug-loop (`.github/bug-loop/*.md`, `.github/workflows/bug-loop-ship.yml`).

### Sweep & Linear projection
- Cron on lenovo: `0 */3 * * * /home/bratmario/triage-brain/scripts/triage-sweep-cron.sh`.
  Gated by `BUG_LOOP_ENABLED`; brackets the LLM sweep with deterministic Linear sync
  (`linear_phase pre` → sweep → `linear_phase post`, `apps/colanode-bot` `triage:linear` =
  `src/linear/run.ts`).
- Sweep (Claude `claude -p` + `triage-sweep` skill) is **eyes-only**: its only tool is the
  allowlisted `triage-ops.sh` gateway (never sees the ops token, no raw shell —
  prompt-injection hardening because it reads untrusted tester text). It never touches code.
- Projection is **plain node, no LLM** (`run.ts`, `description.ts`): one Linear issue per
  cluster (id = cluster.id, lookup-first), machine block between
  `<!-- triage:machine:begin/end -->` markers (human text preserved byte-for-byte),
  containing Impact / Observed-expected / **root-cause hypothesis** / screenshots / recordings /
  evidence / source / possible-related / next-step. Class (bug|feature|unclear|no-fly) → Linear
  label. **No comments written; no workflow-state changes.**

### Lenovo target
- Shared `supabase-db` (`supabase/postgres:15.8.1.085`) at `127.0.0.1:54322`; `vector 0.8.0`,
  `pgcrypto`, `uuid-ossp` available. Identical image to dd → Kysely migrations (up to `00040`)
  apply as-is. This is the multi-tenant `~/supabase-stack` platform (schema/role/key per
  project convention).
- Tailscale Funnel attribute is enabled in the tailnet; lenovo public HTTPS host
  `https://lenovo-home-server.tail1f896c.ts.net`. (Funnel `:443` currently serves manna-crm →
  use an alternate Funnel port for triage ingest to avoid collision.)
- Existing **dev/test** colanode instances on lenovo (the drift trap): `colanode_server_test`
  (:3001), `colanode_postgres` (:5433), `colanode_valkey` (:6380), `colanode_minio` (:9000).
  The prod instance must be kept strictly separate (distinct compose project, ports, network).

---

## 3. Target architecture on lenovo

```
kvota-new (155.212.147.111, external)
   │  POST multipart /client/v1/triage/ingest  (Bearer = triage_projects.ingest_token)
   ▼
Tailscale Funnel  https://lenovo-home-server.tail1f896c.ts.net:<alt-port>
   │  (public HTTPS, TLS terminated by Funnel → forwards to localhost)
   ▼
colanode_server (lenovo, 127.0.0.1:<port>)  ── writes ──▶ triage_reports (status='new')
   │                                                        DB colanode @ supabase-db:54322
   └── Redis (colanode_redis) for jobs/event-bus/rate-limits
                                                          storage volume: server_storage

lenovo cron  * * * * *  →  triage-sweep-guard.sh
   1. cheap pending-check (ops: any report status='new' in non-killswitch projects)
   2. none → exit (~0 cost)
   3. some → flock -n → triage-sweep-cron.sh (linear pre → sweep → linear post) → unlock
   +  safety sweep: keep 0 */3 * * * full run (drains stranded triage/cluster items)
   ▼
Linear issue per cluster (created in team default stage; human moves to Approved for fix)
```

### 3.1 Components to stand up on lenovo
1. **DB** — create role+database `colanode` in the shared lenovo `supabase-db`;
   `CREATE EXTENSION vector`; restore the dd dump (`pg_restore`). This mirrors dd,
   where `colanode` is already a co-tenant of the shared supabase-db. (Owner's choice:
   co-tenant, not a dedicated Postgres.)
2. **Redis** — a **dedicated** `colanode_redis` (`redis:7-alpine`, `--requirepass`).
   Do **not** reuse the dev `colanode_valkey:6380` — keep prod isolated from the drift trap.
3. **Server** — `colanode_server` from the same image, `POSTGRES_URL`→lenovo supabase-db,
   `REDIS_URL`→new redis, publish port on `127.0.0.1:<port>`. Migrate volume `server_storage`
   (`rsync -a`, or `-X` if xattrs matter for content-type — verify), plus `config.json` and
   `apns-auth-key.p8`.
4. **web UI** — **not** migrated. Dropped.

### 3.2 Public ingress
- Expose ingest via **Tailscale Funnel on an alternate port** (`8443` or `10000` — the
  Funnel-allowed ports besides `443`, which manna-crm holds), pointing at the server's
  localhost port: `https://lenovo-home-server.tail1f896c.ts.net:8443/client/v1/triage/ingest`.
  Public HTTPS; kvota-new does **not** join the tailnet; the DB-stored Bearer token protects it
  (safe for Funnel — unlike the open manna-crm case).
- **Repoint kvota-new** ingest URL env (`/root/onestack/.env`) from `chat.kvotaflow.ru` to the
  Funnel URL. Redeploy/restart kvota so the new URL takes effect.
- **Repoint sweep-side URLs to localhost:** `~/.config/triage/env` `TRIAGE_OPS_URL` →
  `http://127.0.0.1:<port>/client/v1/triage/ops` (local, no Funnel needed).
- **Update engine config:** `config.json` `web.domain` / `cors.origin` to the new host.
- **Drop `chat.kvotaflow.ru`** DNS + dd Caddy route after cutover.

> ⚠ Ingress is the trickiest step — validate with a real multipart ingest from kvota-new
> (alt port reachable, multipart passes, Bearer accepted, row created) before repointing.

### 3.3 Near-realtime trigger (minute-cron guard)
- New guard script (e.g. `scripts/triage-sweep-guard.sh`) run by cron `* * * * *`:
  1. cheap pending-check against the **local** ops endpoint — is there any
     `triage_reports.status='new'` in a project without `kill_switch`? (Reuse the existing
     `triage-ops.sh reports <projectId>` per non-killswitch project, or add a lightweight
     `pending` op that returns a single count.)
  2. if zero → exit immediately (near-zero cost; the expensive Claude agent does not run).
  3. if >0 → `flock -n <lockfile>` → run the existing `triage-sweep-cron.sh` (with its
     `linear_phase pre/post`) → release. `flock -n` prevents overlapping sweeps (a sweep
     takes minutes; a concurrent minute tick that can't grab the lock simply skips —
     the next new report will re-trigger).
- **Safety sweep retained:** keep the existing `0 */3 * * *` full run. Rationale (owner's
  call): the pending-check keys on `reports.status='new'`, but the sweep drains multiple
  queues (explode → triage → cluster); items stranded mid-pipeline by a crashed sweep won't
  re-trigger the minute guard. The 3h full run is the catch-all that drains anything missed.
- Latency: report → Linear issue in **~1 minute** (worst case ~1 min guard granularity +
  sweep duration), vs ≤3 h today. Burst dedup quality preserved — reports arriving within a
  guard window are triaged together in one sweep run.

---

## 4. Turn off the duplicate Telegram DM
- The per-bug Telegram DM is on the **kvota** side (`api/feedback.py`, best-effort DM to
  `ADMIN_TELEGRAM_CHAT_ID=43379140`), **not** in the engine.
- **Keep it until realtime Linear is proven on prod for a few days**, then disable/remove the
  DM in `api/feedback.py`. Rationale: don't go blind during the transition; Linear realtime
  depends on the (new) trigger working end-to-end.

---

## 5. Cutover & rollback

**Cutover order:**
1. `pg_dump -Fc colanode` on dd (there is no existing backup — do this first).
2. Stand up on lenovo: role+DB `colanode` in shared supabase-db + `CREATE EXTENSION vector`;
   restore dump; dedicated `colanode_redis`; `colanode_server` (with `config.json`,
   `apns-auth-key.p8`, `server_storage` volume rsync'd). Verify migrations at `00040`,
   server boots healthy.
3. Bring up Funnel ingress on the alt port.
4. **Control ingest from kvota-new** (or a crafted multipart with the project's Bearer):
   1 report → 1 `triage_reports` row → run guard/sweep → 1 Linear issue. Confirm end-to-end.
5. Repoint kvota-new ingest env to the Funnel URL; repoint `TRIAGE_OPS_URL` to localhost;
   update `config.json` host; install the minute-cron guard (keep the 3h safety sweep).
6. Observe in parallel for a few days (dd stack left running as fallback).
7. Retire: drop `chat.kvotaflow.ru` DNS/Caddy, tear down the dd colanode stack, retire the
   CI bug-loop (§6).
8. After realtime Linear is proven: disable the kvota Telegram DM (§4).

**Rollback:** point kvota-new ingest env back to `chat.kvotaflow.ru`; the dd stack stays up
until the lenovo instance is proven (several days), so rollback is a one-line env revert.

---

## 6. Retire the CI auto-fix bug-loop (do not migrate)
- Five `.github/workflows/bug-loop-*.yml` (Claude-based repro→fix→PR→auto-merge→deploy→close),
  gated by repo var `AUTOFIX_ENABLED=true` (armed) but **dormant since ~2026-07-06** (last real
  run was the 2026-07-03 pilot/rollback-drill on issues #10/#14).
- It targets the **retired Colanode web UI** (`fix` scope `apps/web,packages/ui,packages/client`;
  `ship` deploys via `deploy-dd.sh` to `chat.kvotaflow.ru`) and is **not connected to Linear in
  code** (works off GitHub issues+labels; the Linear→fix hop is the manual human `@Codex` step).
- Therefore it is a double leftover: dormant **and** aimed at what we're deleting. **Retire it**
  (unset `AUTOFIX_ENABLED` or remove the workflows) with the domain — **no repoint needed**.

---

## 7. Risks
- **Funnel alt-port ingress** — must verify kvota-new can reach `:8443`/`:10000`, that multipart
  uploads pass, and the Bearer is accepted. Highest-uncertainty step; gate cutover on a real
  control ingest.
- **Drift trap** — keep the prod instance strictly separate from the lenovo dev/test colanode
  stand (`colanode_server_test` et al.): distinct compose project, ports, network, redis. A
  restart of the dev stand must not touch prod.
- **Storage volume fidelity** — `server_storage` holds artifacts; if content-type is stored in
  xattrs, migrate with `rsync -aX` (verify; cf. kvota storage xattr precedent).
- **Secrets** — `config.json`, `.env` (`COLANODE_DB_PASSWORD`, `COLANODE_REDIS_PASSWORD`,
  VAPID keys, `TRIAGE_SERVICE_TOKEN`, `BUG_REPORT_GH_*`), `apns-auth-key.p8` must move securely;
  never commit. Record new locations in `~/infra/README.md` (var name + location only).
- **Sweep cost under minute-cron** — the guard fires 1440×/day but the expensive Claude agent
  only runs when `reports.status='new'>0`; the idle path is one cheap HTTP call. Confirm the
  pending-check is genuinely cheap (single count, non-killswitch projects only).

---

## 8. Open items to resolve in the plan
- Exact server localhost port + Funnel port choice, and the Funnel/serve config form.
- Whether to add a dedicated `pending` ops op vs summing `reports <projectId>` across projects.
- `~/infra/README.md` updates: kvota-new ingest URL, lenovo engine stack (DB co-tenant, redis,
  server, Funnel ingress), removal of the dd colanode stack + `chat.kvotaflow.ru`.
