# Approved-for-fix → Codex Cloud → draft PR

**Date:** 2026-07-24
**Status:** Design approved
**Author:** Andrey + Codex
**Repos:** `AgasiArgent/colanode` (dispatcher), `AgasiArgent/kvota-onestack` (fix target)

---

## 1. Problem and goal

The Kvota feedback engine already turns pin reports into diagnosed Linear issues.
The intended human gate is the `Approved for fix` workflow state, but the
machine-owned description currently contains a literal `@Codex` mention. Linear
interprets that description mention immediately, so Codex Cloud starts while the
issue is still in Triage.

Codex Cloud then produces a useful implementation and tested diff, but the
Codex-for-Linear integration stops at a completed cloud chat. A human must open
that chat and press **Create PR**. This leaves completed work stranded until
Andrey reaches the issue.

The target workflow is:

```text
pin feedback
  → triage + dedup + Linear issue in Triage
  → human moves issue to Approved for fix
  → trusted Lenovo dispatcher mentions @Codex once
  → Codex Cloud implements and validates
  → deterministic Lenovo finalizer applies the Cloud diff
  → draft GitHub PR
  → PR link on Linear + issue moves to In Review
```

The Codex Cloud run consumes Andrey's ChatGPT/Codex subscription. The finalizer
uses only local CLI/Git/GitHub operations; it does not run a second coding model
and does not consume Linear AI credits.

## 2. Verified platform facts

- Codex for Linear is already installed and working for the Kvota workspace.
- A Linear `@Codex` comment creates a Cloud task titled
  `Linear Mention: KVO-NNN: ...`.
- Lenovo's authenticated `codex-cli 0.145.0` supports:
  - `codex cloud list --json`
  - `codex cloud status <task-id>`
  - `codex cloud diff <task-id>`
  - `codex cloud apply <task-id>`
- A live probe successfully listed the current KVO Cloud tasks and retrieved
  KVO-107's two-file diff.
- `gh` is authenticated as `AgasiArgent` with repository access.
- The Kvota Linear team has the exact states `Triage`, `Approved for fix`,
  `In Progress`, `In Review`, `Done`, `Canceled`, `Duplicate`, and `Backlog`.
- A read-only preflight found 44 issues in `Approved for fix`; the exact
  baseline remains intentionally dynamic until rollout.
- Historical Cloud data contains duplicate tasks for some identifiers
  (including KVO-103, KVO-104, and KVO-105). Historical tasks therefore cannot
  be treated as an automatic PR backlog.
- `codex cloud` is currently an experimental CLI surface. The integration must
  fail closed and expose a clear log/comment if its output contract changes.

## 3. Scope

### In scope

- Remove all live Codex mentions from the machine-owned issue description.
- Poll Linear once per minute for issues entering `Approved for fix`.
- Delegate each new approval to Codex exactly once through a Linear comment.
- Match the resulting Cloud task to its KVO identifier and dispatch timestamp.
- Apply the completed Cloud diff in a temporary `kvota-onestack` worktree.
- Push a deterministic branch and open a **draft** PR.
- Link the task and PR back to Linear and move the issue to `In Review`.
- Persist enough state to survive restarts without duplicate tasks or PRs.
- Add a separate kill switch, single-flight lock, runbook, tests, and logging.

### Non-goals

- No automatic merge or production deployment.
- No second local Codex/Claude implementation pass.
- No processing of historical Cloud tasks.
- No automatic PR for issues already approved at rollout time.
- No generalized multi-project automation in v1.
- No browser automation or private ChatGPT endpoints.
- No changes to triage, clustering, or deduplication behavior.

## 4. Components

### 4.1 Linear human-gate text

`apps/colanode-bot/src/linear/description.ts` keeps the human-gate section but
changes its copy to:

> Move to **Approved for fix**. Automation will delegate the issue to Codex and
> open a draft PR.

The machine block must contain no case-insensitive `@codex` substring.

### 4.2 Linear dispatcher

A new `apps/colanode-bot/src/codex-fix/` module runs as a deterministic Node
process. It uses the existing `LinearApi` credential boundary and adds only the
API methods needed to:

- list all issues in one workflow state, with recent comments;
- create a comment;
- resolve a workflow-state ID by name;
- update an issue's workflow state.

The visible trigger comment is:

```md
@Codex implement this approved issue in `AgasiArgent/kvota-onestack`.

Read the complete issue, linked issues, and attached evidence. Make the smallest
correct change, add or update regression tests, and run the relevant checks.
Leave a PR-ready diff; a deterministic finalizer will open the draft PR.

<!-- kvota:codex-fix-dispatch:v1 -->
```

The HTML marker lets a later process restart reconstruct that delegation and
prevents a second mention if the local state write was interrupted.

### 4.3 Durable local state

State lives outside git at a configurable path, defaulting to:

`~/.local/state/triage-codex-fix/state.json`

Schema v1 stores:

- initialization timestamp;
- the set of issue IDs observed in `Approved for fix` on the previous poll;
- per-issue dispatch comment ID and timestamp;
- bound Cloud task ID and URL;
- deterministic branch name;
- terminal outcome and PR URL, when present.

Writes use a sibling temporary file followed by atomic rename. A missing state
file invokes bootstrap behavior. Malformed or unsupported state fails closed;
the worker does not silently reset and re-dispatch.

### 4.4 Cloud task adapter

The worker calls `codex cloud list --json --limit 20`, following cursors for a
bounded number of pages. It validates the external JSON before use.

A candidate task must satisfy all of:

- title starts with `Linear Mention: <issue identifier>:`;
- task update time is not earlier than the dispatch comment;
- task belongs to the configured `kvota-onestack` environment label.

The first unambiguous candidate is bound permanently to the issue. Historical
tasks older than the dispatch comment are ignored. If multiple new candidates
exist before binding, the issue is blocked and no diff is applied.

Only `status=ready` tasks can advance. A ready task with zero changed files gets
a Linear comment and no PR. Known failed/canceled terminal statuses also get a
single failure comment. Unknown statuses remain pending.

### 4.5 Draft-PR publisher

For a ready task with changed files:

1. Derive branch `codex/<kvo-id-lower>-<task-id-suffix>`.
2. Ask GitHub whether a PR already exists for that exact head branch.
3. If the PR exists, reuse it and repair only missing Linear state/comment.
4. If the remote branch exists without a PR, create the draft PR from it.
5. Otherwise:
   - fetch `origin/main` in the configured local `kvota-onestack` repository;
   - create a unique detached temporary worktree under the dispatcher state root;
   - run `codex cloud apply <task-id>` inside that worktree;
   - require a non-empty change and pass `git diff --check`;
   - commit as `fix: KVO-NNN`;
   - push `HEAD:refs/heads/<deterministic-branch>`;
   - remove the temporary worktree;
   - create the draft PR with explicit `--head` and `--base main`.

The PR body links the Linear issue and Cloud task and states that it is an
automatically materialized Cloud diff requiring human review.

After GitHub returns a PR URL, the worker posts one Linear comment containing
the PR link and a hidden completion marker, then moves the issue to `In Review`.
If either Linear mutation fails, the next run repairs it without creating
another branch or PR.

## 5. Transition detection and rollout safety

The worker compares the current approved issue-ID set with the previous poll.
Only IDs newly present in the set are eligible for a new trigger.

On the first successful run:

- record all current approved issue IDs;
- create no `@Codex` comments;
- bind no historical Cloud tasks;
- open no PRs.

This deliberately baselines every issue currently approved at rollout. To
process one of those later, a human can move it out of `Approved for fix` and
back after the worker is live.

The dispatcher also recognizes its marker comments. If Linear accepted the
comment but the process crashed before state persistence, the next run records
the existing marker rather than mentioning Codex again.

## 6. Failure behavior

All ambiguous or unsafe conditions fail closed:

| Condition | Result |
|---|---|
| Dispatcher kill switch off | Exit 0 without API/CLI work |
| State missing | Baseline current approvals, no delegation |
| State malformed/version unknown | Exit non-zero, log error, no delegation |
| Multiple matching new Cloud tasks | Mark blocked, comment once, no PR |
| Cloud task not ready | Keep pending |
| Ready task has no diff | Comment once, no PR |
| `codex cloud` JSON contract changes | Exit non-zero, no PR |
| Patch does not apply | Comment once, no branch/PR |
| `git diff --check` fails | Comment once, no branch/PR |
| Push succeeds but PR creation fails | Next run reuses deterministic remote branch |
| PR exists but Linear update fails | Next run reuses PR and repairs Linear |

The automation never merges, deploys, closes an issue, or deletes a remote
branch.

## 7. Security boundaries

- Linear issue text is untrusted. It is sent to Codex only through the existing
  Linear integration and is never interpolated into a shell command.
- External commands use argument arrays (`execFile`), never `sh -c`.
- `LINEAR_API_KEY` and `TRIAGE_OPS_TOKEN` are removed from child environments
  before invoking `codex`, `git`, or `gh`.
- Secrets remain in `~/.config/triage/env`; only variable names and locations
  are documented.
- The Cloud diff is applied only inside a newly created temporary worktree of
  the configured target repository.
- Repository slug, local target path, team ID, state names, base branch, and
  environment label come from trusted configuration.
- Separate `flock` prevents overlapping dispatcher runs.

## 8. Runtime configuration

Existing:

- `LINEAR_API_KEY`
- `TRIAGE_REPO`

New:

- `CODEX_FIX_LOOP_ENABLED` — independent kill switch, default off.
- `CODEX_FIX_LINEAR_TEAM_ID`
- `CODEX_FIX_APPROVED_STATE` — `Approved for fix`
- `CODEX_FIX_REVIEW_STATE` — `In Review`
- `CODEX_FIX_TARGET_REPO`
- `CODEX_FIX_GITHUB_REPO` — `AgasiArgent/kvota-onestack`
- `CODEX_FIX_BASE_BRANCH` — `main`
- `CODEX_FIX_CLOUD_ENVIRONMENT` — `kvota-onestack`
- Optional `CODEX_FIX_STATE_FILE`, `CODEX_FIX_LOG`, and `CODEX_FIX_LOCK`.

Cron:

```cron
* * * * * /home/bratmario/triage-brain/scripts/triage-codex-fix-cron.sh
```

The script sources `~/.config/triage/env`, honors the independent kill switch,
uses a non-blocking lock, and appends structured one-line summaries to its log.

## 9. Verification and rollout

Code verification:

- focused Vitest tests for Linear API boundaries, state persistence, transition
  detection, task matching, duplicate handling, and PR idempotency;
- bot lint and TypeScript compile;
- ShellCheck and fake-command integration checks for the cron wrapper;
- existing bot suite remains green.

Live rollout:

1. Merge the dispatcher PR to `feat/triage-u1-on-prod-line`.
2. Repin `/home/bratmario/triage-brain` to that merge commit and install deps.
3. Add new variable names/values to `~/.config/triage/env`, with the kill switch
   initially false.
4. Install the minute cron entry.
5. Re-project Linear descriptions to remove the old live mentions.
6. Run once with a foreground-only switch override and verify the JSON reports
   `baselined` equal to `approved`, with no new Codex task and no PR.
7. Use one controlled issue: move it from Triage to `Approved for fix`.
8. Verify exactly one trigger comment, one Cloud task, one draft PR, one Linear
   PR comment, and final state `In Review`.
9. Persist the enabled kill switch only after the baseline control passes;
   leave it on after the end-to-end control passes.
10. Update `~/infra/README.md` with the cron, state/log paths, variable names,
    and rollback command.

Rollback is immediate: set `CODEX_FIX_LOOP_ENABLED=false`. Existing Cloud tasks
and draft PRs remain visible for manual handling; no destructive cleanup runs.
