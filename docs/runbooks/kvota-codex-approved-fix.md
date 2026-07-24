# Kvota Approved-for-fix Codex draft-PR runbook

This runbook installs and operates the deterministic Lenovo loop that turns a
KVO issue newly moved to `Approved for fix` into one Codex Cloud task and, when
that task is ready, one draft PR in `AgasiArgent/kvota-onestack`.

The loop never merges or deploys. Its independent kill switch defaults to off.
The first enabled run is a baseline-only run: every issue already approved is
recorded without a Codex mention, Cloud-task lookup, branch, or PR.

## Runtime topology

- Worker code: pinned detached checkout `/home/bratmario/triage-brain`
- Target repository: `/home/bratmario/kvota`
- Environment file: `/home/bratmario/.config/triage/env` (mode `0600`)
- State: `/home/bratmario/.local/state/triage-codex-fix/state.json`
- Log: `/home/bratmario/.config/triage/codex-fix.log`
- Lock: `/tmp/triage-codex-fix.lock`
- Linear team: KVO (`489f172f-5289-46d1-be03-226736198d5f`)
- Cloud environment label: `kvota-onestack`

Only variable names and locations belong in documentation. Never copy the
`LINEAR_API_KEY` value into this file, logs, commands, or issue comments.

## 1. Preflight

Run these as `bratmario` on Lenovo:

```bash
codex login status
codex cloud list --json --limit 1 | jq -e '.tasks | type == "array"'
gh auth status
git -C /home/bratmario/kvota remote get-url origin
git -C /home/bratmario/kvota ls-remote --exit-code origin refs/heads/main
stat -c '%a %U:%G %n' /home/bratmario/.config/triage/env
```

Required results:

- Codex reports a ChatGPT login and Cloud list returns valid JSON.
- `gh` is authenticated as `AgasiArgent`.
- the target remote is `AgasiArgent/kvota-onestack`;
- `origin/main` exists;
- the triage env file is owned by `bratmario` and has mode `600`.

Stop if any check fails.

## 2. Merge and repin the worker checkout

Merge the implementation PR into `feat/triage-u1-on-prod-line`. Do not deploy
directly from the feature-PR branch. Then repin the runtime checkout to the
reviewed merge commit:

```bash
git -C /home/bratmario/triage-brain fetch origin feat/triage-u1-on-prod-line
CODEX_FIX_REVISION="$(git -C /home/bratmario/triage-brain rev-parse FETCH_HEAD)"
git -C /home/bratmario/triage-brain checkout --detach "$CODEX_FIX_REVISION"
test "$(git -C /home/bratmario/triage-brain rev-parse HEAD)" = "$CODEX_FIX_REVISION"
npm --prefix /home/bratmario/triage-brain ci
```

The pinned checkout must remain detached and clean. Never edit it in place.

## 3. Configure with the kill switch off

Keep the existing `LINEAR_API_KEY` and `TRIAGE_REPO` entries. Add the following
entries to `/home/bratmario/.config/triage/env`, initially with
`CODEX_FIX_LOOP_ENABLED=false`:

```dotenv
CODEX_FIX_LOOP_ENABLED=false
CODEX_FIX_LINEAR_TEAM_ID=489f172f-5289-46d1-be03-226736198d5f
CODEX_FIX_APPROVED_STATE="Approved for fix"
CODEX_FIX_REVIEW_STATE="In Review"
CODEX_FIX_TARGET_REPO=/home/bratmario/kvota
CODEX_FIX_GITHUB_REPO=AgasiArgent/kvota-onestack
CODEX_FIX_BASE_BRANCH=main
CODEX_FIX_CLOUD_ENVIRONMENT=kvota-onestack
CODEX_FIX_STATE_FILE=/home/bratmario/.local/state/triage-codex-fix/state.json
CODEX_FIX_LOG=/home/bratmario/.config/triage/codex-fix.log
CODEX_FIX_LOCK=/tmp/triage-codex-fix.lock
```

Then enforce the file mode and validate the disabled path:

```bash
chmod 600 /home/bratmario/.config/triage/env
CODEX_FIX_LOOP_ENABLED=false \
  npm --prefix /home/bratmario/triage-brain/apps/colanode-bot \
  run -s triage:codex-fix
```

Expected output:

```json
{"event":"codex-fix-run","skipped":true,"reason":"disabled"}
```

## 4. Install the inert cron

Add exactly this line with `crontab -e`:

```cron
* * * * * /home/bratmario/triage-brain/scripts/triage-codex-fix-cron.sh
```

Verify there is exactly one active entry:

```bash
crontab -l | grep -Fxc \
  '* * * * * /home/bratmario/triage-brain/scripts/triage-codex-fix-cron.sh'
```

The result must be `1`. While the env switch is false, the entry exits without
calling Linear, Codex, Git, or GitHub.

## 5. Remove the old description trigger

Before arming the new loop, re-run the deterministic projector so every
machine-owned KVO description replaces the old literal `@Codex` gate text:

```bash
(
  set -a
  . /home/bratmario/.config/triage/env
  set +a
  npm --prefix /home/bratmario/triage-brain/apps/colanode-bot \
    run -s triage:linear -- --phase post
)
```

Verify in a projected KVO issue that the human-gate section says automation
will delegate after approval and contains no literal `@Codex`. Do not arm the
new loop until this is true.

## 6. Perform the baseline-only control run

The state file must not already exist on the first rollout:

```bash
test ! -e /home/bratmario/.local/state/triage-codex-fix/state.json
```

Keep the persisted kill switch false and enable only this foreground process:

```bash
(
  set -a
  . /home/bratmario/.config/triage/env
  set +a
  export CODEX_FIX_LOOP_ENABLED=true
  npm --prefix /home/bratmario/triage-brain/apps/colanode-bot \
    run -s triage:codex-fix
)
```

The JSON summary must report:

- `baselined` equal to `approved`;
- `dispatched: 0`;
- `bound: 0`;
- `published: 0`;
- `failed: 0`.

This path returns before calling `codex cloud list`. Verify private state and a
second idempotent run:

```bash
stat -c '%a %U:%G %n' \
  /home/bratmario/.local/state/triage-codex-fix/state.json
jq '{version, initializedAt, approved: (.approvedIssueIds | length), issueRuns: (.issues | length)}' \
  /home/bratmario/.local/state/triage-codex-fix/state.json

(
  set -a
  . /home/bratmario/.config/triage/env
  set +a
  export CODEX_FIX_LOOP_ENABLED=true
  npm --prefix /home/bratmario/triage-brain/apps/colanode-bot \
    run -s triage:codex-fix
)
```

The state mode must be `600`; the second summary must have
`baselined: 0`, `dispatched: 0`, and `published: 0`.

If the first run dispatches anything, immediately set the switch false and
stop. Do not continue with the pilot.

## 7. Arm the minute loop

Change only this entry in `/home/bratmario/.config/triage/env`:

```dotenv
CODEX_FIX_LOOP_ENABLED=true
```

Wait one minute and verify a clean no-op summary:

```bash
tail -20 /home/bratmario/.config/triage/codex-fix.log
```

The summary should show the current approved count with zeros for new
dispatches and publications.

## 8. Controlled end-to-end pilot

Choose one real, bounded KVO issue in `Triage` whose fix is safe to review.
Record its identifier as `KVO-NNN`, then move it once to `Approved for fix`.

Verify the following in order:

1. Linear receives exactly one comment containing
   `<!-- kvota:codex-fix-dispatch:v1 -->` and one `@Codex`.
2. The next worker summaries show `dispatched: 1`, then `bound: 1` or
   `pending: 1`.
3. `codex cloud list --json --limit 20` shows one new task titled
   `Linear Mention: KVO-NNN: ...` in environment `kvota-onestack`.
4. When the task becomes `ready`, state records its exact task ID, task URL,
   deterministic branch, and PR URL:

   ```bash
   jq --arg identifier KVO-NNN \
     '.issues | to_entries[] | select(.value.identifier == $identifier) | .value' \
     /home/bratmario/.local/state/triage-codex-fix/state.json
   ```

5. The GitHub URL opens one **draft** PR against `main`. Its body links both
   the Linear issue and the exact Codex Cloud task.
6. Linear receives exactly one comment containing
   `<!-- kvota:codex-fix-pr:v1 -->` and the PR URL, then moves to `In Review`.
7. Another minute produces no second task, branch, PR, or completion comment.

The Cloud run can take longer than one poll. `pending: 1` is normal. Leave the
switch on only if every completed step has exactly-once behavior.

## 9. Normal operation

Useful read-only checks:

```bash
tail -100 /home/bratmario/.config/triage/codex-fix.log
jq '{initializedAt, approvedIssueIds, issues}' \
  /home/bratmario/.local/state/triage-codex-fix/state.json
codex cloud list --json --limit 20 | jq '.tasks[] | {id, title, status, environment_label, updated_at}'
gh pr list --repo AgasiArgent/kvota-onestack --state all --limit 100 \
  --json number,title,url,state,isDraft,headRefName,baseRefName \
  | jq '.[] | select(.headRefName | startswith("codex/"))'
```

Each successful worker execution writes one `codex-fix-run` JSON line. A
non-zero wrapper exit appends a timestamped failure line. A held lock logs a
skip and prevents overlap.

## 10. Failure recovery

### Immediate stop

Set `CODEX_FIX_LOOP_ENABLED=false` in
`/home/bratmario/.config/triage/env`. The next cron invocation becomes inert.
This does not cancel an already running Cloud task and does not delete a branch
or PR.

### Malformed state or Cloud JSON contract change

Keep the switch off. Back up the state file, inspect the log, and fix or restore
the state; do not delete it and silently re-bootstrap:

```bash
cp -p /home/bratmario/.local/state/triage-codex-fix/state.json \
  /home/bratmario/.local/state/triage-codex-fix/state.json.backup
```

If the Cloud CLI schema changed, update and verify the adapter before
re-enabling. State parse/schema failures are deliberately fail-closed.

### Duplicate matching Cloud tasks

The issue becomes `blocked`, gets one error comment, and opens no PR. Keep the
switch off while selecting the one trustworthy task. Back up state, find the
Linear issue UUID, and atomically bind the chosen task:

```bash
CODEX_FIX_STATE=/home/bratmario/.local/state/triage-codex-fix/state.json
CODEX_FIX_IDENTIFIER=KVO-NNN
CODEX_FIX_TASK_ID=task_e_...
CODEX_FIX_TASK_URL=https://chatgpt.com/codex/tasks/task_e_...
CODEX_FIX_ISSUE_UUID="$(
  jq -r --arg identifier "$CODEX_FIX_IDENTIFIER" \
    '.issues | to_entries[] | select(.value.identifier == $identifier) | .key' \
    "$CODEX_FIX_STATE"
)"
test -n "$CODEX_FIX_ISSUE_UUID"
cp -p "$CODEX_FIX_STATE" "$CODEX_FIX_STATE.backup"
CODEX_FIX_TEMP="$(mktemp "$CODEX_FIX_STATE.repair.XXXXXX")"
jq \
  --arg issue "$CODEX_FIX_ISSUE_UUID" \
  --arg task "$CODEX_FIX_TASK_ID" \
  --arg url "$CODEX_FIX_TASK_URL" \
  '.issues[$issue] |= (
    .outcome = "pending"
    | .taskId = $task
    | .taskUrl = $url
    | del(.lastError, .branch, .prUrl)
  )' "$CODEX_FIX_STATE" >"$CODEX_FIX_TEMP"
chmod 600 "$CODEX_FIX_TEMP"
mv "$CODEX_FIX_TEMP" "$CODEX_FIX_STATE"
```

Run one foreground control invocation before re-enabling cron.

### Patch/apply validation failure

`codex cloud apply`, an empty patch, or `git diff --cached --check` failure is
terminal and opens no branch/PR. Correct the issue or base-branch condition,
back up state, and change only that issue's `outcome` from `failed` to
`pending`, deleting `lastError`. If a replacement Cloud task was intentionally
created, also set its exact `taskId` and `taskUrl` using the atomic procedure
above. Run once in the foreground and inspect the result before re-enabling.

### Push succeeded but PR creation failed

No manual state edit is required. The issue stays pending. A later run detects
the deterministic remote branch, skips Cloud apply, and retries draft-PR
creation.

### PR exists but Linear completion failed

No manual state edit is required. State is saved as `pr_opened` before Linear
is updated. The next run reuses the PR, repairs the marked Linear comment, and
moves the issue to `In Review`.

## 11. Rollback

Set the independent kill switch false:

```dotenv
CODEX_FIX_LOOP_ENABLED=false
```

Optionally remove the one cron line after confirming it is disabled. Preserve
the state file, log, existing Cloud tasks, branches, and draft PRs for audit and
manual handling.

After the live rollout or any rollback, update `/home/bratmario/infra/README.md`
in the same task with the active cron status, state/log paths, configuration
variable names and locations, and the rollback switch. Never record credential
values there.
