#!/usr/bin/env bash
# Triage sweep entrypoint for lenovo cron (every 3h).
# Env file must define: TRIAGE_OPS_URL, TRIAGE_OPS_TOKEN, BUG_LOOP_ENABLED.
set -u

REPO="${TRIAGE_REPO:-$HOME/workspace/colanode}"
ENV_FILE="${TRIAGE_ENV_FILE:-$HOME/.config/triage/env}"
LOG="${TRIAGE_LOG:-$HOME/.config/triage/sweep.log}"

mkdir -p "$(dirname "$LOG")"
set -a
# shellcheck disable=SC1090
[ -f "$ENV_FILE" ] && . "$ENV_FILE"
set +a

case "${BUG_LOOP_ENABLED:-}" in
  1 | true | yes | on) ;;
  *)
    echo "$(date -Is) BUG_LOOP_ENABLED is off — skipping sweep" >>"$LOG"
    exit 0
    ;;
esac

cd "$REPO" || exit 1
claude -p "Use the triage-sweep skill to run one sweep." \
  --allowedTools "Bash(curl:*)" 2>&1 | tee -a "$LOG"
exit "${PIPESTATUS[0]}"
