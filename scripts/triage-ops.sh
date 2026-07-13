#!/usr/bin/env bash
# Allowlisted ops-API gateway for the triage sweep.
#
# The sweep agent is granted ONLY this script (--allowedTools), never raw bash or
# curl. It therefore cannot reach any host but the ops-API, cannot read the token,
# and cannot exfiltrate. The token and URL are read from the env file HERE, so they
# never enter the agent's environment.
#
# Usage:
#   triage-ops.sh projects
#   triage-ops.sh reports <projectId>
#   triage-ops.sh untriaged <projectId>     # items awaiting triage (RESUME path)
#   triage-ops.sh unclustered <projectId>   # triaged items awaiting clustering
#   triage-ops.sh explode <reportId>
#   triage-ops.sh patch-item <itemId> <json>
#   triage-ops.sh create-cluster <json>
set -euo pipefail

ENV_FILE="${TRIAGE_ENV_FILE:-$HOME/.config/triage/env}"
[ -f "$ENV_FILE" ] || { echo "triage-ops: env file not found: $ENV_FILE" >&2; exit 2; }
# shellcheck disable=SC1090
. "$ENV_FILE"
: "${TRIAGE_OPS_URL:?triage-ops: TRIAGE_OPS_URL not set}"
: "${TRIAGE_OPS_TOKEN:?triage-ops: TRIAGE_OPS_TOKEN not set}"

# Ids are opaque slugs/uuids — reject anything that could smuggle a path or a host.
require_id() {
  case "$1" in
    *[!A-Za-z0-9_-]* | '') echo "triage-ops: invalid id: $1" >&2; exit 2 ;;
  esac
}

# Bodies must be well-formed JSON objects; the agent never hand-rolls a request.
require_json() {
  printf '%s' "$1" | jq -e 'type == "object"' >/dev/null 2>&1 \
    || { echo "triage-ops: body is not a JSON object" >&2; exit 2; }
}

api() {
  local method="$1" path="$2" body="${3:-}"
  local -a args=(-sS --fail-with-body --max-time 30
    -X "$method"
    -H "Authorization: Bearer ${TRIAGE_OPS_TOKEN}")
  if [ -n "$body" ]; then
    args+=(-H 'Content-Type: application/json' --data-binary "$body")
  fi
  # URL is always derived from TRIAGE_OPS_URL — never from agent input.
  curl "${args[@]}" "${TRIAGE_OPS_URL}${path}"
}

cmd="${1:-}"
case "$cmd" in
  projects)
    api GET "/projects"
    ;;
  reports)
    require_id "${2:-}"
    api GET "/reports?status=new&limit=50&projectId=$2"
    ;;
  # Items, not reports, are the unit of work: explode flips a report to
  # `exploded` immediately, so a run that died mid-way would strand its items
  # forever if the sweep only ever looked at new reports. These two verbs are
  # the resume path.
  untriaged)
    require_id "${2:-}"
    api GET "/items?status=new&limit=100&projectId=$2"
    ;;
  unclustered)
    require_id "${2:-}"
    api GET "/items?status=triaged&unclustered=true&limit=100&projectId=$2"
    ;;
  explode)
    require_id "${2:-}"
    api POST "/reports/$2/explode"
    ;;
  patch-item)
    require_id "${2:-}"
    require_json "${3:-}"
    api PATCH "/items/$2" "$3"
    ;;
  create-cluster)
    require_json "${2:-}"
    api POST "/clusters" "$2"
    ;;
  *)
    echo "triage-ops: unknown command: ${cmd:-<none>}" >&2
    echo "usage: projects | reports <projectId> | untriaged <projectId> | unclustered <projectId> | explode <reportId> | patch-item <itemId> <json> | create-cluster <json>" >&2
    exit 2
    ;;
esac
