# Kvota Linear rollout runbook

Operator checklist for cutting the kvota triage project over from the
Colanode board to Linear (team **KVO**), per the grouping/projection design
(`docs/superpowers/specs/2026-07-16-kvota-linear-feedback-grouping-design.md`
§13) and plan Task 13. Steps are ordered and gated — do not skip ahead; every
step ends with a verification before the next one starts.

**Topology reminder:** the triage server (ops API + Postgres) runs on **dd**
(`chat.kvotaflow.ru`); the sweep cron + deterministic Linear projector run on
**lenovo** from the pinned checkout `TRIAGE_REPO`. All ops-API calls below use
the service token:

```bash
# Run on lenovo. TRIAGE_OPS_URL already ends in /client/v1/triage/ops.
. ~/.config/triage/env   # defines TRIAGE_OPS_URL, TRIAGE_OPS_TOKEN, ...
```

---

## Step 1 — Add `LINEAR_API_KEY` to the projector env

The deterministic projector is the **only** reader of the Linear key (spec
§5.3, §11). It lives in the cron env file on lenovo and nowhere else — never
in the DB, ops API, sweep prompts, or logs.

```bash
# On lenovo — append the workspace pilot key:
chmod 600 ~/.config/triage/env
printf 'LINEAR_API_KEY=lin_api_...\n' >> ~/.config/triage/env
```

Record the **var name + location only** (never the value) in
`~/infra/README.md` (credentials inventory section) in the same task:
`LINEAR_API_KEY — ~/.config/triage/env on lenovo (triage Linear projector)`.

Verify:

```bash
grep -c '^LINEAR_API_KEY=' ~/.config/triage/env   # -> 1
```

## Step 2 — Fetch KVO team id + label ids, store the (disabled) mapping

One GraphQL query fetches the team and both label ids (covers team-level and
workspace-level labels):

```bash
. ~/.config/triage/env
curl -sS https://api.linear.app/graphql \
  -H "Authorization: $LINEAR_API_KEY" \
  -H 'Content-Type: application/json' \
  --data-binary '{"query":"{ teams(filter:{key:{eq:\"KVO\"}}){nodes{id key name labels(filter:{name:{in:[\"Bug\",\"Feature\"]}}){nodes{id name}}}} issueLabels(filter:{name:{in:[\"Bug\",\"Feature\"]}}){nodes{id name team{key}}} }"}' | jq .
```

Take `teamId` from `teams.nodes[0].id` and the `Bug`/`Feature` label ids
(prefer the team-scoped ones; workspace-level ids from `issueLabels` are fine
if the team has none). Then store the mapping with projection **disabled** and
the cutover timestamp set to the planned deploy time (historical clusters stay
out of Linear — only clusters created at/after `cutoverAt` are ever queued):

```bash
# Current name must be re-sent (PUT is a full upsert of the mutable fields).
curl -sS -H "Authorization: Bearer $TRIAGE_OPS_TOKEN" "$TRIAGE_OPS_URL/projects" \
  | jq '.projects[] | select(.id == "kvota")'

DEPLOY_ISO=$(date -u +%Y-%m-%dT%H:%M:%SZ)   # or the planned deploy time
curl -sS -X PUT "$TRIAGE_OPS_URL/projects/kvota" \
  -H "Authorization: Bearer $TRIAGE_OPS_TOKEN" \
  -H 'Content-Type: application/json' \
  --data-binary @- <<EOF | jq .linear
{
  "name": "<current name from the GET above>",
  "linear": {
    "enabled": false,
    "teamId": "<KVO team id>",
    "teamKey": "KVO",
    "cutoverAt": "$DEPLOY_ISO",
    "labels": { "bug": "<Bug label id>", "feature": "<Feature label id>" }
  }
}
EOF
```

Verify the mapping **round-trips** — the response (and a fresh
`GET /projects`) must show the `linear` object you sent, with
`enabled: false`:

```bash
curl -sS -H "Authorization: Bearer $TRIAGE_OPS_TOKEN" "$TRIAGE_OPS_URL/projects" \
  | jq '.projects[] | select(.id == "kvota") | .linear'
```

> If `linear` comes back `{}`, the deployed server predates this branch's
> project-upsert (older versions lacked `linear` in the upsert schema, so Zod
> stripped it — the PUT silently dropped the field). Run the Step 3 deploy
> first, then re-run this PUT and re-verify the round-trip. As an emergency
> stopgap only (requires migration 00040 to be applied), set it directly and
> re-verify via the GET:
>
> ```bash
> ssh dd 'docker exec supabase-db psql -U postgres -d colanode -c \
>   "UPDATE triage_projects SET linear = '\''{\"enabled\": false, \"teamId\": \"<id>\", \"teamKey\": \"KVO\", \"cutoverAt\": \"<ISO>\", \"labels\": {\"bug\": \"<id>\", \"feature\": \"<id>\"}}'\''::jsonb, updated_at = now() WHERE id = '\''kvota'\''"'
> ```

## Step 3 — Deploy PR 1+2, run migration 00040

Deploy the server (dd) and update the pinned cron checkout (lenovo):

```bash
# From the colanode repo on lenovo, on the merge commit being deployed:
bash scripts/staging-stack.sh up       # build staging images + healthy staging stack
bash scripts/deploy-dd.sh              # ship colanode-server/web images to dd
bash scripts/staging-stack.sh down     # tear staging back down

# Update the cron's pinned checkout to the same revision:
git -C "$TRIAGE_REPO" fetch origin main && git -C "$TRIAGE_REPO" checkout --detach origin/main
```

Migration `00040_add_triage_linear_projection` runs automatically on server
boot (`migrateToLatest` in `apps/server/src/index.ts`). Verify it applied and
the new tables exist:

```bash
ssh dd 'docker exec supabase-db psql -U postgres -d colanode -c \
  "SELECT name FROM kysely_migration ORDER BY timestamp DESC LIMIT 3"'
ssh dd 'docker exec supabase-db psql -U postgres -d colanode -c \
  "\\d triage_cluster_relations" -c "\\d triage_linear_issues" -c "\\d triage_linear_sync_state"'
```

## Step 4 — Empirical `ensureIssue` idempotency check (scratch issue)

The issue-create retry protocol is lookup-first because duplicate-UUID
`issueCreate` behavior is undocumented (spec §8). Prove it against the real
API with one scratch UUID: two `ensureIssue` calls must yield **exactly one**
KVO issue.

```bash
cd "$TRIAGE_REPO"
cat > /tmp/linear-scratch-check.ts <<EOF
import { LinearApi } from '$TRIAGE_REPO/apps/colanode-bot/src/linear/client';

const api = new LinearApi(process.env.LINEAR_API_KEY!);
const id = crypto.randomUUID();
const input = {
  id,
  teamId: '<KVO team id from Step 2>',
  title: 'triage rollout scratch — safe to delete',
  description: 'ensureIssue idempotency probe (kvota-linear-rollout Step 4)',
  labelIds: [],
};
const first = await api.ensureIssue(input);
const second = await api.ensureIssue(input);
console.log(JSON.stringify({ id, first: first.identifier, second: second.identifier }));
if (first.id !== second.id) throw new Error('NOT IDEMPOTENT — two issues created');
console.log('OK: one issue, delete it now:', first.identifier, first.url);
EOF
( set -a; . ~/.config/triage/env; set +a
  npm --prefix apps/colanode-bot exec -- tsx /tmp/linear-scratch-check.ts )
```

Confirm in the KVO Triage view that exactly one scratch issue exists, then
delete it:

```bash
. ~/.config/triage/env
curl -sS https://api.linear.app/graphql \
  -H "Authorization: $LINEAR_API_KEY" -H 'Content-Type: application/json' \
  --data-binary '{"query":"mutation($id: String!){ issueDelete(id:$id){ success } }","variables":{"id":"<scratch issue uuid printed above>"}}' | jq .
rm /tmp/linear-scratch-check.ts
```

If the check prints `NOT IDEMPOTENT`, **stop the rollout** — do not proceed to
Step 6 until the create protocol is fixed and this step passes.

## Step 5 — Shadow window (grouping ON, projection OFF)

With `linear.enabled` still `false`, the deployed sweep already runs the
three-outcome grouping (attach / create-with-relation / create) but nothing
reaches Linear. Before flipping the switch, run the fixtures gate and review
every real `same` decision:

1. Run the shadow eval in `fixtures/triage-grouping/README.md` (Task 12)
   against a dev DB. **Gate: zero cases where the sweep chose `same` but the
   label is not `same`.**
2. For the live shadow window (several sweep cycles, i.e. 1–2 days of the 3h
   cron), review every proposed `same` in the audit log:

```bash
# Attaches recorded by the sweep since the deploy (audit actor 'ops',
# changes.attach = target cluster):
ssh dd 'docker exec supabase-db psql -U postgres -d colanode -c \
  "SELECT i.id AS item, i.summary, e->'\''changes'\''->>'\''attach'\'' AS attached_to,
          e->'\''changes'\''->>'\''confidence'\'' AS confidence, e->'\''changes'\''->>'\''reason'\'' AS reason, e->>'\''at'\'' AS at
   FROM triage_items i, jsonb_array_elements(i.audit) e
   WHERE i.project_id = '\''kvota'\'' AND e->'\''changes'\'' ? '\''attach'\''
     AND (e->>'\''at'\'')::timestamptz > now() - interval '\''2 days'\''
   ORDER BY at DESC"'
# Sweep-side log on lenovo:
tail -100 ~/.config/triage/sweep.log
```

A human confirms each attach is a true duplicate. **Zero false merges →
proceed.** Any false merge: dismiss/fix the cluster, tighten the sweep-skill
`same` bar, and restart the shadow window.

## Step 6 — Enable projection, run the six-step end-to-end pilot

Flip the flag (same PUT as Step 2, now `"enabled": true`, all other `linear`
fields re-sent unchanged), then verify:

```bash
curl -sS -H "Authorization: Bearer $TRIAGE_OPS_TOKEN" "$TRIAGE_OPS_URL/projects" \
  | jq '.projects[] | select(.id == "kvota") | .linear.enabled'   # -> true
```

From here the cron brackets each sweep with the projector
(`triage-sweep-cron.sh`: reconcile `pre` → sweep → project `post`). To drive
the pilot without waiting for the 3h cron, run phases by hand on lenovo:

```bash
run_sweep() { bash "$TRIAGE_REPO/scripts/triage-sweep-cron.sh"; }
linear_phase() { ( set -a; . ~/.config/triage/env; set +a
  npm --prefix "$TRIAGE_REPO/apps/colanode-bot" run -s triage:linear -- --phase "$1" ); }
```

Six-step pilot (spec §12), each step verified in the KVO Triage view before
the next:

1. **Report A → one issue.** Submit report A via an in-app pin on
   app.kvotaflow.ru; `run_sweep` → exactly one new KVO issue in Triage, with
   the machine-owned block (Impact / behavior / hypothesis / screenshots /
   video links) between the `triage:machine` markers.
2. **Clear duplicate B → same issue.** Submit a clear duplicate of A;
   `run_sweep` → **no** new issue; A's issue now shows `Reports: 2` and B's
   evidence in the behavior section.
3. **Uncertain C → related pair.** Submit an ambiguous C; `run_sweep` → a
   separate KVO issue, and **both** issues carry the related-issues summary +
   the "check before fixing" instruction.
4. **Human duplicate.** In Linear, mark C's issue `Duplicate of` A's issue;
   `linear_phase pre` → reconciliation records A as canonical
   (`triage_linear_issues.canonical_cluster_id` set on C's cluster; audit row
   present).
5. **C-like attach goes to the canonical.** Submit another C-like report;
   `run_sweep` → it attaches to **A's** issue, not the duplicate.
6. **Idempotent re-run.** `linear_phase pre && run_sweep && linear_phase post`
   with no new input → zero new issues, relations, comments, or re-uploaded
   attachments; run log shows
   `linear: kvota reconciled=... created=0 updated=0 relations=0 failures=0`.

Any failure: set `linear.enabled` back to `false` (projection stops; nothing
else breaks), fix, and repeat the failed step.

## Step 7 — Freeze "Testing 2", KVO manual-bug template, announce pins-only

1. **Freeze the deprecated "Testing 2" sheet.** It is abandoned — nothing is
   imported from it. Rename it with a `[FROZEN — пины в приложении]` prefix
   and revoke testers' edit access (view-only), so nothing new lands there.
2. **Create the KVO template for manually filed bugs** (Linear UI: Team KVO →
   Settings → Templates → New template, labels `Bug`), mirroring the
   machine-owned layout so human and machine issues read the same:

   ```markdown
   ## Impact
   - Reports: 1
   - First/last seen:

   ## Observed and expected behavior
   **<who/where>** — <title> (<reporter>, <page URL>)
   - Did:
   - Expected:
   - Observed:

   ## Reproduction clues and root-cause hypothesis
   Root-cause hypothesis (unverified, a hypothesis until confirmed in code):

   ## Screenshots
   <!-- paste images; they upload as Linear-hosted assets -->
   ```

3. **Announce the pins-only flow** in the testers' Telegram group ("Project
   KVOTAFLOW") via the `notify-testers` skill: bugs are reported ONLY through
   in-app pins from now on; the sheet is frozen; each pin becomes/joins a KVO
   issue automatically; manual bugs (rare) use the KVO template.

## Step 8 — Three real bugs through `Approved for fix` → manual `@Codex`

Run three real, pilot-verified bugs through the existing manual path: move
each KVO issue to `Approved for fix`, then mention `@Codex` on the issue to
delegate.

During these three, **empirically note** (in the issue comments or the pilot
notes doc):

- whether Codex actually received/used the **embedded screenshots** from the
  machine-owned description (Linear-hosted uploads);
- whether Codex saw and respected the **related-issues summary** (the
  "possibly related — check before fixing" instruction), i.e. whether it
  checked the related issue before fixing.

These observations feed the spec §13 step-7 reassessment (thresholds,
candidate volume, embeddings) — file them before closing the rollout.

---

## Rollback

- **Projection off:** PUT `linear.enabled: false` (Step 2 call) — the sweep
  and Colanode-side triage keep working; clusters stay dirty and re-project
  when re-enabled.
- **Sweep off entirely:** set `BUG_LOOP_ENABLED=0` in `~/.config/triage/env`
  (global kill switch); per-project `killSwitch: true` via the same PUT.
- **Server:** `scripts/rollback-dd.sh` restores the `:prev` images on dd.
  Migration 00040 is additive; downgrade only via its `down` if the schema
  itself must go.
