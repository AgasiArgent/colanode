#!/usr/bin/env bash
# Triage sweep entrypoint for lenovo cron (every 3h).
# Env file must define: TRIAGE_OPS_URL, TRIAGE_OPS_TOKEN, BUG_LOOP_ENABLED.
#
# Security: the sweep reads tester-submitted text (report titles, pin comments) —
# untrusted input that could carry a prompt injection. It therefore runs WITHOUT
# --dangerously-skip-permissions and is granted exactly ONE tool: triage-ops.sh,
# which owns the ops-API URL and token. The agent gets no raw shell and no curl, so
# an injected report cannot run commands, reach another host, or exfiltrate. The
# token is never exported into the agent's environment — triage-ops.sh reads it.
set -u

ENV_FILE="${TRIAGE_ENV_FILE:-$HOME/.config/triage/env}"

# Sourced WITHOUT `set -a`, so nothing here (notably TRIAGE_OPS_TOKEN) is exported
# into the environment inherited by the claude subprocess. Sourced BEFORE REPO/LOG
# are resolved, so the env file can set TRIAGE_REPO / TRIAGE_LOG.
# shellcheck disable=SC1090
[ -f "$ENV_FILE" ] && . "$ENV_FILE"

# The sweep must run from a checkout PINNED to a revision that carries this
# script, scripts/triage-ops.sh and the triage-sweep skill — never from a working
# checkout whose branch moves under us.
REPO="${TRIAGE_REPO:-$HOME/workspace/colanode}"
LOG="${TRIAGE_LOG:-$HOME/.config/triage/sweep.log}"

mkdir -p "$(dirname "$LOG")"

# cron provides a minimal PATH; the claude CLI lives in ~/.local/bin.
export PATH="$HOME/.local/bin:$PATH"

case "${BUG_LOOP_ENABLED:-}" in
  1 | true | yes | on) ;;
  *)
    echo "$(date -Is) BUG_LOOP_ENABLED is off — skipping sweep" >>"$LOG"
    exit 0
    ;;
esac

cd "$REPO" || exit 1

# Only the env-file PATH is exported (not a secret); triage-ops.sh reads the URL and
# token from it at call time.
export TRIAGE_ENV_FILE="$ENV_FILE"

# </dev/null: the sweep takes no stdin; without it the CLI stalls 3s waiting for it.
claude -p "Use the triage-sweep skill to run one sweep." \
  --allowedTools 'Bash(./scripts/triage-ops.sh:*)' </dev/null 2>&1 | tee -a "$LOG"
exit "${PIPESTATUS[0]}"
