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
