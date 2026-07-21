# Triage engine → lenovo migration + near-realtime trigger — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the triage engine (Colanode fork) from dd to lenovo and cut bug→Linear latency from ≤3h to ~1min via a minute-cron pending-guard, retiring the Colanode UI, the `chat.kvotaflow.ru` domain, and the dormant CI auto-fix bug-loop.

**Architecture:** Two tracks. **Track A (code → /sol, become PRs in `AgasiArgent/colanode`)**: a trusted minute-cron guard script that cheaply checks for pending reports and only then runs the existing hardened sweep, plus retiring the CI bug-loop. **Track B (infra runbook → interactive on live machines)**: DB dump/restore dd→lenovo, stand up redis+server, Tailscale Funnel ingress, repoint kvota-new ingest env, cutover, teardown. **Track C (deferred, post-cutover)**: disable the redundant kvota Telegram DM once realtime Linear is proven.

**Tech Stack:** Bash + cron + flock; Docker Compose; Postgres 15 (`supabase/postgres:15.8.1.085`) + pgvector; Redis 7; Tailscale Funnel; Node (colanode server, `apps/colanode-bot` Linear sync); Claude `claude -p` sweep agent.

## Global Constraints

- Sweep agent stays **eyes-only**: its only tool remains `Bash(./scripts/triage-ops.sh:*)`; it never gets raw shell/curl, never sees `TRIAGE_OPS_TOKEN` or `LINEAR_API_KEY`. The guard is trusted infra and MAY talk to the DB directly — the guard is **not** the agent.
- **No change to triage/dedup logic or Linear annotation behavior.** The sweep already never sets/changes Linear workflow state; do not add state changes. Leave `apps/colanode-bot/src/linear/description.ts` `## Next step (human gate)` block as-is.
- DB `colanode` requires only `CREATE EXTENSION vector`; no RLS, no extra schemas, owner role `colanode`.
- Redis is mandatory — the server will not boot without it.
- Secrets (`config.json`, `.env`, `apns-auth-key.p8`, `COLANODE_DB_PASSWORD`, `COLANODE_REDIS_PASSWORD`, VAPID, `TRIAGE_SERVICE_TOKEN`) never get committed; record locations (var name + location only) in `~/infra/README.md`.
- Prod instance on lenovo MUST stay separate from the dev/test colanode stand (`colanode_server_test`, `colanode_postgres:5433`, `colanode_valkey:6380`, `colanode_minio:9000`): distinct compose project, ports, network, redis.
- Keep the dd stack running until the lenovo instance is proven (several days) — rollback = revert one kvota-new env var.

**Design spec:** `docs/superpowers/specs/2026-07-20-triage-engine-lenovo-realtime-design.md`

---

# TRACK A — Code changes (execute via /sol)

## Task A1: Minute-cron pending-guard for the sweep

**Files:**
- Create: `scripts/triage-sweep-guard.sh`
- Reference (do not modify): `scripts/triage-sweep-cron.sh`, `scripts/triage-ops.sh`

**Interfaces:**
- Consumes: existing `scripts/triage-sweep-cron.sh` (full sweep entrypoint; honors `BUG_LOOP_ENABLED`, runs `linear_phase pre` → `claude -p` sweep → `linear_phase post`). Env file `~/.config/triage/env` (may define `TRIAGE_REPO`, `TRIAGE_LOG`).
- Produces: `scripts/triage-sweep-guard.sh` — invoked two ways by cron:
  - `triage-sweep-guard.sh` — pending-gated: runs the sweep only if ≥1 `triage_reports.status='new'` exists in a non-killswitch project.
  - `triage-sweep-guard.sh --force` — always runs the sweep (the 3h safety catch-all that also drains stranded triage/cluster items).
  - Both share one `flock -n` lock so sweeps never overlap.

**Behavior contract:**
- Pending count via `docker exec supabase-db psql` (trusted; local DB on lenovo). Container name `supabase-db`, DB `colanode`.
- `flock -n` on `/tmp/triage-sweep.lock`: if a sweep is already running, exit 0 silently (the next new report re-triggers within a minute).
- Logs to the same `TRIAGE_LOG` as the cron script.

- [ ] **Step 1: Write the guard script**

Create `scripts/triage-sweep-guard.sh`:

```bash
#!/usr/bin/env bash
# Minute-cron pending-guard around triage-sweep-cron.sh.
#
# The 3h cron alone means a bug waits up to 3h for its Linear issue. This guard
# runs every minute but only fires the (expensive) sweep when there is actually a
# new report, so idle minutes cost one cheap local COUNT and nothing else.
#
# This script is TRUSTED cron infra, NOT the sweep agent — so it MAY query the DB
# directly. The agent's hardening (gateway-only, no token) is unchanged; the guard
# only decides *whether* to launch triage-sweep-cron.sh, which itself runs the
# hardened agent.
#
# Cron wiring (crontab):
#   * * * * *   $REPO/scripts/triage-sweep-guard.sh            # pending-gated realtime
#   0 */3 * * * $REPO/scripts/triage-sweep-guard.sh --force    # safety: drains stranded items
set -u

ENV_FILE="${TRIAGE_ENV_FILE:-$HOME/.config/triage/env}"
# shellcheck disable=SC1090
[ -f "$ENV_FILE" ] && . "$ENV_FILE"

REPO="${TRIAGE_REPO:-$HOME/workspace/colanode}"
LOG="${TRIAGE_LOG:-$HOME/.config/triage/sweep.log}"
LOCK="${TRIAGE_LOCK:-/tmp/triage-sweep.lock}"
DB_CONTAINER="${TRIAGE_DB_CONTAINER:-supabase-db}"
DB_NAME="${TRIAGE_DB_NAME:-colanode}"
DB_USER="${TRIAGE_DB_USER:-postgres}"

mkdir -p "$(dirname "$LOG")"
export PATH="$HOME/.local/bin:$PATH"

force=0
[ "${1:-}" = "--force" ] && force=1

# --- pending check (skipped in --force mode) ---------------------------------
if [ "$force" -eq 0 ]; then
  pending="$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAc \
    "SELECT count(*) FROM triage_reports r JOIN triage_projects p ON p.id = r.project_id WHERE r.status = 'new' AND coalesce(p.kill_switch, false) = false" 2>>"$LOG")"
  # On any DB error, pending is empty → treat as 0 (the 3h --force run is the safety net).
  if ! [ "${pending:-0}" -gt 0 ] 2>/dev/null; then
    exit 0
  fi
  echo "$(date -Is) guard: ${pending} pending report(s) — acquiring lock" >>"$LOG"
fi

# --- single-flight: never overlap sweeps -------------------------------------
exec 9>"$LOCK"
if ! flock -n 9; then
  echo "$(date -Is) guard: sweep already running — skip" >>"$LOG"
  exit 0
fi

exec "$REPO/scripts/triage-sweep-cron.sh"
```

- [ ] **Step 2: Make executable + shellcheck**

Run:
```bash
chmod +x scripts/triage-sweep-guard.sh
shellcheck scripts/triage-sweep-guard.sh
```
Expected: exit 0, no warnings (SC1090 is inline-disabled).

- [ ] **Step 3: Dry-run the pending-check path in isolation**

Verify the guard exits cleanly when the DB is unreachable (simulates idle/error → must be a no-op, not a crash):
```bash
TRIAGE_DB_CONTAINER=nonexistent-db TRIAGE_LOG=/tmp/guard-test.log \
  scripts/triage-sweep-guard.sh; echo "exit=$?"
```
Expected: `exit=0` (DB error → pending empty → treated as 0 → clean exit). `/tmp/guard-test.log` may contain a psql error line; that's fine.

- [ ] **Step 4: Verify --force bypasses the pending-check**

With a bogus REPO so the sweep entrypoint is a harmless failure, confirm `--force` reaches the exec (does not early-exit on pending):
```bash
TRIAGE_REPO=/tmp/nonexistent-repo TRIAGE_LOG=/tmp/guard-test2.log \
  scripts/triage-sweep-guard.sh --force; echo "exit=$?"
```
Expected: non-zero exit from the failed `cd`/exec inside `triage-sweep-cron.sh` (i.e. it PASSED the pending gate and the lock, then tried to run the sweep) — NOT `exit=0` from an early pending-return.

- [ ] **Step 5: Commit**

```bash
git add scripts/triage-sweep-guard.sh
git commit -m "feat(triage): minute-cron pending-guard for near-realtime sweep

Guard runs every minute, fires the existing hardened sweep only when a
new report exists (cheap local COUNT), sharing one flock with the 3h
--force safety run so sweeps never overlap. Cuts bug->Linear latency
from <=3h to ~1min. Agent hardening unchanged; guard is trusted infra."
```

---

## Task A2: Retire the dormant CI auto-fix bug-loop

**Rationale:** The `.github/workflows/bug-loop-*.yml` pipeline (Claude-based repro→fix→PR→merge→deploy) is dormant since ~2026-07-06, targets the **retired** Colanode web UI (`fix` scope `apps/web,packages/ui,packages/client`; `ship` deploys via `deploy-dd.sh` to `chat.kvotaflow.ru`), and is not connected to Linear. It dies with the domain.

**Files:**
- Delete: `.github/workflows/bug-loop-*.yml` (5 files), `.github/bug-loop/` (prompt dir)
- (The repo variable `AUTOFIX_ENABLED` is unset separately in Track B — it is not a repo file.)

- [ ] **Step 1: Enumerate exactly what exists (do not guess)**

Run:
```bash
ls -1 .github/workflows/bug-loop-*.yml
ls -1 .github/bug-loop/
```
Record the exact file list. Confirm all are bug-loop-only (no shared workflow logic).

- [ ] **Step 2: Confirm nothing else references these workflows**

Run:
```bash
grep -rniE 'bug-loop' .github --include='*.yml' | grep -v 'bug-loop-'
grep -rn 'bug-loop' scripts/ apps/ 2>/dev/null | head
```
Expected: no OTHER workflow triggers/`uses:` these (they trigger off GitHub issue labels + `push` to main with `[bug-loop#...]` in the message — self-contained). If a shared step is found, stop and flag it.

- [ ] **Step 3: Remove the workflows and prompts**

```bash
git rm .github/workflows/bug-loop-*.yml
git rm -r .github/bug-loop/
```

- [ ] **Step 4: Verify the tree still lints (no dangling references)**

```bash
grep -rn 'bug-loop' .github/ 2>/dev/null; echo "residual refs above (should be empty)"
```
Expected: empty.

- [ ] **Step 5: Commit**

```bash
git commit -m "chore(ci): retire dormant auto-fix bug-loop

The bug-loop targeted the now-retired Colanode web UI and deployed to
chat.kvotaflow.ru (both removed in the lenovo migration). Dormant since
~2026-07-06, never connected to Linear. AUTOFIX_ENABLED repo var unset
separately during cutover."
```

---

# TRACK B — Infra runbook (interactive, sequential, NOT /sol)

> Run these on the live machines in order, verifying each before the next.
> `<PORT>` = chosen server localhost port; `<FUNNEL_PORT>` = 8443 or 10000.
> Resolve both at Step B3/B4. Keep the dd stack up throughout.

### B1 — Pre-flight backup (dd)
```bash
ssh dd 'docker exec supabase-db pg_dump -Fc -U postgres -d colanode' > ~/triage-colanode-$(date +%Y%m%d).dump
ls -lh ~/triage-colanode-*.dump    # expect ~a few MB (DB is 11MB)
```
Verify: dump file non-empty. (No prior backup exists on dd — this is the safety net.)

### B2 — Provision DB on lenovo (co-tenant in shared supabase-db)
```bash
# create role + database (password from a fresh secret; store in the new env, not here)
docker exec -i supabase-db psql -U postgres <<'SQL'
CREATE ROLE colanode LOGIN PASSWORD :'pw';   -- supply via -v pw=... ; do not hardcode
CREATE DATABASE colanode OWNER colanode;
SQL
docker exec -i supabase-db psql -U postgres -d colanode -c 'CREATE EXTENSION IF NOT EXISTS vector;'
cat ~/triage-colanode-*.dump | docker exec -i supabase-db pg_restore -U postgres -d colanode --no-owner --role=colanode
```
Verify:
```bash
docker exec supabase-db psql -U postgres -d colanode -c "SELECT count(*) FROM triage_reports; SELECT count(*) FROM triage_clusters;"
# expect reports≈54, clusters≈51 (matches dd)
docker exec supabase-db psql -U postgres -d colanode -c "\dx" | grep vector
```

### B3 — Stand up redis + server on lenovo (separate compose project)
- Author a lenovo prod compose (e.g. `~/colanode-prod/docker-compose.yml`, compose project `colanode-prod`, distinct from the dev stand) with:
  - `colanode_redis` (`redis:7-alpine`, `--requirepass "$COLANODE_REDIS_PASSWORD"`, own volume, internal network only).
  - `colanode_server` (image `colanode-server:dd` — copy from dd or rebuild), `POSTGRES_URL=postgres://colanode:...@supabase-db:5432/colanode`, `REDIS_URL=redis://:...@colanode_redis:6379/0`, published `127.0.0.1:<PORT>:<container-port>`, joined to the `supabase` network (external) for DB access.
- Copy config + secrets from dd (securely, never via a synced/committed path):
```bash
ssh dd 'cat /home/anton/colanode/config.json' > ~/colanode-prod/config.json
ssh dd 'cat /home/anton/colanode/apns-auth-key.p8' > ~/colanode-prod/apns-auth-key.p8
# recreate ~/colanode-prod/.env with COLANODE_DB_PASSWORD, COLANODE_REDIS_PASSWORD,
# VAPID keys, TRIAGE_SERVICE_TOKEN, BUG_REPORT_GH_* (values from dd .env)
```
- Migrate the storage volume (artifacts):
```bash
ssh dd 'docker run --rm -v colanode_server_storage:/v -w /v alpine tar cf - .' \
  | docker run --rm -i -v colanode-prod_server_storage:/v -w /v alpine tar xf -
# if content-type lives in xattrs, re-do with tar --xattrs on both sides (verify first)
```
- Edit `config.json`: set `web.domain` and `cors.origin` to the new Funnel host (see B4), keep `postgres.url`/`redis.url` pointing at the lenovo services, keep `triage.serviceToken`.
- Bring up:
```bash
cd ~/colanode-prod && docker compose up -d
docker logs colanode_server --tail 50   # expect healthy boot, migrations at 00040, no Redis errors
```
Verify: `curl -s http://127.0.0.1:<PORT>/config` returns 200.

### B4 — Public ingress via Tailscale Funnel (alt port)
```bash
tailscale funnel --bg --https=<FUNNEL_PORT> 127.0.0.1:<PORT>
tailscale funnel status    # confirm https://lenovo-home-server.tail1f896c.ts.net:<FUNNEL_PORT> → 127.0.0.1:<PORT>
```
Verify from OUTSIDE the tailnet (e.g. from kvota-new):
```bash
ssh kvota-new 'curl -s -o /dev/null -w "%{http_code}\n" https://lenovo-home-server.tail1f896c.ts.net:<FUNNEL_PORT>/config'
# expect 200 — proves the external prod VPS can reach lenovo ingest
```
> ⚠ This is the highest-risk step. If `<FUNNEL_PORT>` is unreachable or multipart is blocked, do NOT proceed to B7 — diagnose first (Funnel port allowlist is 443/8443/10000; 443 is held by manna-crm).

### B5 — Control ingest end-to-end (before repointing kvota)
- Send one crafted multipart ingest with a valid project Bearer (`triage_projects.ingest_token`) to the Funnel URL `/client/v1/triage/ingest`.
- Verify the chain:
```bash
docker exec supabase-db psql -U postgres -d colanode -c "SELECT id,status,created_at FROM triage_reports ORDER BY created_at DESC LIMIT 1"   # new row, status='new'
# point ~/.config/triage/env TRIAGE_OPS_URL at http://127.0.0.1:<PORT>/client/v1/triage/ops first (B6), then:
$REPO/scripts/triage-sweep-guard.sh          # should detect pending, run sweep
# → check a Linear issue was created for the new cluster
```

### B6 — Repoint sweep-side to localhost + install the guard cron
```bash
# ~/.config/triage/env: TRIAGE_OPS_URL=http://127.0.0.1:<PORT>/client/v1/triage/ops (TOKEN unchanged)
crontab -e
#   remove/replace the old:  0 */3 * * * .../scripts/triage-sweep-cron.sh
#   add:
#   * * * * *   $REPO/scripts/triage-sweep-guard.sh
#   0 */3 * * * $REPO/scripts/triage-sweep-guard.sh --force
```
Verify: `grep triage /var/log/syslog` shows the minute job firing; idle minutes cost ~nothing (guard exits 0 with no sweep).

### B7 — Repoint kvota-new ingest env → Funnel URL
```bash
ssh kvota-new 'grep -n triage /root/onestack/.env'   # find the ingest URL var
# edit that var: https://chat.kvotaflow.ru/... → https://lenovo-home-server.tail1f896c.ts.net:<FUNNEL_PORT>/...
# redeploy/restart kvota so the new URL takes effect (per onestack deploy runbook)
```
Verify: submit a real pin from `app.kvotaflow.ru` → a `triage_reports` row appears on lenovo within seconds → a Linear issue within ~1 min.

### B8 — Observe in parallel (dd still up), several days
Watch `~/.config/triage/sweep.log` and Linear for a few days. Rollback if needed = revert the kvota-new env var to `chat.kvotaflow.ru`.

### B9 — Teardown (only after proven)
```bash
# unset the CI bug-loop flag (Track A2 removed the workflows)
gh variable delete AUTOFIX_ENABLED -R AgasiArgent/colanode
# drop chat.kvotaflow.ru DNS + dd Caddy route; tear down the dd colanode stack
ssh dd 'cd /home/anton/colanode && docker compose down'
```

### B10 — Update infra docs
- `~/infra/README.md`: kvota-new ingest URL (Funnel), lenovo engine stack (DB co-tenant in supabase-db, `colanode_redis`, `colanode_server`, Funnel `<FUNNEL_PORT>`), removal of dd colanode stack + `chat.kvotaflow.ru`. Record new secret **locations** only (var name + path), never values.

---

# TRACK C — Deferred (post-cutover, after realtime Linear proven)

## Task C1: Disable the redundant kvota Telegram per-bug DM

**Repo:** `kvota-onestack` (different repo — separate /sol run or inline edit).

**Files:**
- Modify: `api/feedback.py` (the best-effort DM to `ADMIN_TELEGRAM_CHAT_ID=43379140`)

- [ ] **Step 1: Locate the DM call**
```bash
grep -n 'ADMIN_TELEGRAM_CHAT_ID\|telegram\|send_message' api/feedback.py
```
- [ ] **Step 2: Remove the per-bug DM path** (feedback still forwards to the triage engine — only the Telegram notification is removed, since Linear now shows issues in ~1 min). Keep the ingest-forward and error handling intact.
- [ ] **Step 3: Verify** a submitted pin still creates a Linear issue and no longer sends a TG DM.
- [ ] **Step 4: Commit** in the onestack repo.

---

## Self-Review

**Spec coverage:**
- §3.1 components (DB co-tenant, dedicated redis, server, drop web) → B2, B3. ✓
- §3.2 ingress (Funnel alt-port, repoint kvota-new, repoint TRIAGE_OPS_URL, drop domain) → B4, B6, B7, B9. ✓
- §3.3 minute-cron guard + flock + 3h safety → Task A1 + B6. ✓
- §4 disable TG DM → Track C. ✓
- §5 cutover order + rollback → B1–B9. ✓
- §6 retire CI bug-loop → Task A2 + B9 (`AUTOFIX_ENABLED`). ✓
- §7 risks (Funnel, drift trap, xattrs, secrets, sweep cost) → B4 warning, Global Constraints, B3 xattr note, B10. ✓
- §8 open items (port choices, pending mechanism) → resolved: pending via direct `docker exec psql` (no new ops op); ports as `<PORT>`/`<FUNNEL_PORT>` chosen at B3/B4. ✓

**Placeholder scan:** `<PORT>`/`<FUNNEL_PORT>` are runtime infra values explicitly resolved at B3/B4 (not code placeholders). Guard script is complete. No TODOs.

**Type consistency:** guard env var names (`TRIAGE_REPO`, `TRIAGE_LOG`, `TRIAGE_ENV_FILE`) match `triage-sweep-cron.sh`. Lock/DB-container vars self-consistent within the guard. ✓
