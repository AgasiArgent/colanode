#!/usr/bin/env bash
# Minute-cron entrypoint for Approved-for-fix → Codex Cloud → draft PR.
#
# This is deterministic trusted infrastructure. It invokes no coding model
# itself: Linear creates the Codex Cloud task, then the worker applies that
# task's exact diff and opens a draft PR. A separate kill switch and lock keep
# this loop independent from the triage sweep.
set -u

ENV_FILE="${TRIAGE_ENV_FILE:-$HOME/.config/triage/env}"
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  . "$ENV_FILE" || exit 1
fi

case "${CODEX_FIX_LOOP_ENABLED:-}" in
  1 | true | yes | on) ;;
  *) exit 0 ;;
esac

REPO="${TRIAGE_REPO:-$HOME/workspace/colanode}"
LOG="${CODEX_FIX_LOG:-$HOME/.config/triage/codex-fix.log}"
LOCK="${CODEX_FIX_LOCK:-/tmp/triage-codex-fix.lock}"

mkdir -p "$(dirname "$LOG")"
export PATH="$HOME/.local/bin:$PATH"

exec 9>"$LOCK"
if ! flock -n 9; then
  echo "$(date -Is) codex-fix: another run holds the lock — skip" >>"$LOG"
  exit 0
fi

(
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
  npm --prefix "$REPO/apps/colanode-bot" run -s triage:codex-fix
) >>"$LOG" 2>&1
status="$?"

if [ "$status" -ne 0 ]; then
  echo "$(date -Is) codex-fix: run failed with exit $status" >>"$LOG"
fi
exit "$status"
