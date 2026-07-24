# Approved-for-fix → Codex Cloud → draft PR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delegate only newly approved KVO issues to Codex Cloud and automatically materialize each completed Cloud diff as an idempotent draft GitHub PR linked back to Linear.

**Architecture:** A minute-cron Node worker compares the current `Approved for fix` set with its durable baseline, creates one marked Linear `@Codex` comment per new transition, binds the resulting Cloud task, and hands ready diffs to a deterministic Git/GitHub publisher. Linear markers, a versioned atomic state file, deterministic branch names, and GitHub lookup make every boundary retry-safe; ambiguous conditions fail closed.

**Tech Stack:** TypeScript/Node 20, Vitest, Linear GraphQL, Codex CLI Cloud commands, Git, GitHub CLI, Bash cron wrapper, JSON state.

## Global Constraints

- First live run baselines all current approved issues and MUST create zero comments, tasks, branches, or PRs.
- Only issues newly entering exact state `Approved for fix` after bootstrap are delegated.
- The machine-owned Linear description MUST NOT contain a case-insensitive `@codex` substring.
- Cloud work uses the existing ChatGPT/Codex login; there is no Platform API key and no second model run.
- Historical Cloud tasks are ignored by requiring task time ≥ dispatch-comment time.
- More than one eligible unbound Cloud task is a hard stop for that issue.
- Every PR is draft. Automation never merges, deploys, closes an issue, or deletes a remote branch.
- External commands use argument arrays, never shell interpolation.
- Strip `LINEAR_API_KEY` and `TRIAGE_OPS_TOKEN` from all `codex`, `git`, and `gh` child environments.
- The finalizer works only in a new temporary worktree of `CODEX_FIX_TARGET_REPO`.
- `codex cloud` is experimental: validate its JSON and fail closed on schema drift.
- The rollout has an independent `CODEX_FIX_LOOP_ENABLED` kill switch, initially false.

**Design spec:** `docs/superpowers/specs/2026-07-24-approved-fix-codex-draft-pr-design.md`

---

### Task 1: Make the human gate inert and extend the Linear boundary

**Files:**
- Modify: `apps/colanode-bot/src/linear/description.ts`
- Modify: `apps/colanode-bot/src/linear/client.ts`
- Modify: `apps/colanode-bot/test/linear-description.test.ts`
- Modify: `apps/colanode-bot/test/linear-client.test.ts`

**Interfaces:**
- Produces: `LinearComment`, `LinearFixIssue`, `LinearWorkflowState`.
- Produces: `LinearApi.issuesByState(teamId, stateName)`.
- Produces: `LinearApi.createComment(issueId, body)`.
- Produces: `LinearApi.workflowStateByName(teamId, stateName)`.
- Produces: `LinearApi.updateIssueState(issueId, stateId)`.

- [ ] **Step 1: Write failing description and client tests**

Add a behavior assertion that `buildMachineBlock()` contains the human gate but
does not match `/@codex/i`.

Add GraphQL-boundary tests with literal response fixtures:

```ts
it('lists every issue in the requested state with its comments', async () => {
  // Two paginated responses; expect two complete LinearFixIssue values.
});

it('creates a marked comment and returns its server timestamp', async () => {
  // Expect mutation variables { input: { issueId, body } }.
});

it('resolves and applies the named review state', async () => {
  // Team states response → selected ID → issueUpdate stateId.
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
cd apps/colanode-bot
npx vitest run test/linear-description.test.ts test/linear-client.test.ts
```

Expected: description test fails because `@Codex` is live; client tests fail
because the methods do not exist.

- [ ] **Step 3: Implement the minimal Linear behavior**

Use paginated GraphQL:

```ts
type LinearComment = {
  id: string;
  body: string;
  createdAt: string;
};

type LinearFixIssue = {
  id: string;
  identifier: string;
  title: string;
  url: string;
  stateName: string;
  comments: LinearComment[];
};
```

Change the gate copy to:

```text
Move to **Approved for fix**. Automation will delegate the issue to Codex and open a draft PR.
```

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the same Vitest command. Expected: all selected tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/colanode-bot/src/linear apps/colanode-bot/test/linear-*.test.ts
git commit -m "fix(triage): restore the approved-for-fix Codex gate"
```

---

### Task 2: Add versioned state and validated Cloud task discovery

**Files:**
- Create: `apps/colanode-bot/src/codex-fix/types.ts`
- Create: `apps/colanode-bot/src/codex-fix/state.ts`
- Create: `apps/colanode-bot/src/codex-fix/cloud.ts`
- Create: `apps/colanode-bot/test/codex-fix-state.test.ts`
- Create: `apps/colanode-bot/test/codex-fix-cloud.test.ts`

**Interfaces:**
- Produces: `DispatcherStateV1`, `IssueDispatchState`, `CloudTask`.
- Produces: `loadDispatcherState(path): Promise<DispatcherStateV1 | null>`.
- Produces: `saveDispatcherState(path, state): Promise<void>`.
- Produces: `CloudTasks.list(): Promise<CloudTask[]>`.
- Consumes: injected `CommandRunner(command, args, options)`.

- [ ] **Step 1: Write failing state tests**

Cover:

```ts
it('returns null only when the state file does not exist', async () => {});
it('round-trips state through an atomic sibling rename', async () => {});
it('rejects malformed JSON instead of silently baselining', async () => {});
it('rejects unsupported state versions', async () => {});
```

- [ ] **Step 2: Verify state tests fail for missing modules**

Run:

```bash
npx vitest run test/codex-fix-state.test.ts
```

- [ ] **Step 3: Implement state validation and atomic persistence**

Validate every boundary field manually; do not add a dependency. Write mode
`0600`, then rename the sibling temporary file to the canonical path.

- [ ] **Step 4: Write failing Cloud adapter tests**

Cover:

```ts
it('paginates codex cloud list and returns validated tasks', async () => {});
it('rejects a task missing id, status, timestamp, or summary', async () => {});
it('passes an opaque cursor as one execFile argument', async () => {});
it('removes Linear and triage secrets from the command environment', async () => {});
```

- [ ] **Step 5: Verify Cloud tests fail, then implement minimal adapter**

Invoke:

```text
codex cloud list --json --limit 20
codex cloud list --json --limit 20 --cursor <opaque>
```

Cap pagination at twenty pages (400 tasks) and reject a twenty-first cursor
rather than silently returning an incomplete set. The verified live history at
design time is 110 tasks across six pages.

- [ ] **Step 6: Run state and Cloud tests GREEN**

```bash
npx vitest run test/codex-fix-state.test.ts test/codex-fix-cloud.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add apps/colanode-bot/src/codex-fix apps/colanode-bot/test/codex-fix-{state,cloud}.test.ts
git commit -m "feat(triage): track approvals and discover Codex Cloud tasks"
```

---

### Task 3: Implement transition detection and task binding

**Files:**
- Create: `apps/colanode-bot/src/codex-fix/dispatcher.ts`
- Create: `apps/colanode-bot/test/codex-fix-dispatcher.test.ts`

**Interfaces:**
- Consumes: Linear methods from Task 1, state functions and `CloudTasks` from Task 2.
- Consumes: injected `DraftPrPublisher.publish(issue, task)`.
- Produces: `runCodexFixDispatcher(config, deps): Promise<RunSummary>`.

- [ ] **Step 1: Write the bootstrap RED test**

```ts
it('baselines every currently approved issue without delegating', async () => {
  const issues = [approved('KVO-4'), approved('KVO-6')];
  const summary = await runCodexFixDispatcher(config, deps);
  expect(summary).toEqual(expect.objectContaining({ baselined: 2, dispatched: 0 }));
  expect(linear.createComment).not.toHaveBeenCalled();
  expect(cloud.list).not.toHaveBeenCalled();
});
```

Verify it fails because the dispatcher does not exist, then implement only
bootstrap plus the `approvedIssueIds` state write.

- [ ] **Step 2: Write and satisfy the new-transition RED test**

Previous state contains KVO-4; current approved set contains KVO-4 + KVO-109.
Assert exactly one KVO-109 comment containing one `@Codex`, the configured repo,
and `<!-- kvota:codex-fix-dispatch:v1 -->`.

- [ ] **Step 3: Write and satisfy crash-recovery marker test**

State lacks KVO-109 dispatch details, but its Linear comments contain the
dispatch marker. Assert no second comment and recovered `dispatchedAt`.

- [ ] **Step 4: Write and satisfy task-matching tests**

Cover independently:

- historical matching task before dispatch is ignored;
- wrong environment label is ignored;
- one task after dispatch binds;
- two tasks after dispatch block the issue and never call the publisher;
- an unready task stays pending;
- a ready zero-diff task comments once and never publishes.

- [ ] **Step 5: Write and satisfy successful handoff test**

For one bound ready task with changed files, assert that the real dispatcher
returns the publisher's PR URL, creates one completion comment with
`<!-- kvota:codex-fix-pr:v1`, and updates the issue to the resolved `In Review`
state ID.

- [ ] **Step 6: Run dispatcher tests GREEN**

```bash
npx vitest run test/codex-fix-dispatcher.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add apps/colanode-bot/src/codex-fix/dispatcher.ts apps/colanode-bot/test/codex-fix-dispatcher.test.ts
git commit -m "feat(triage): delegate newly approved KVO issues once"
```

---

### Task 4: Materialize a Cloud diff as an idempotent draft PR

**Files:**
- Create: `apps/colanode-bot/src/codex-fix/publisher.ts`
- Create: `apps/colanode-bot/test/codex-fix-publisher.test.ts`

**Interfaces:**
- Consumes: `LinearFixIssue`, `CloudTask`, injected `CommandRunner`.
- Produces: `DraftPrPublisher.publish(issue, task): Promise<{ url: string; branch: string }>`.

- [ ] **Step 1: Write the existing-PR RED test**

Give the fake runner an existing `gh pr list` JSON response. Assert the
publisher returns that URL without calling `codex cloud apply`, `git push`, or
`gh pr create`.

- [ ] **Step 2: Implement existing-PR lookup**

The first command must use explicit repository and deterministic head branch:

```text
gh pr list --repo <repo> --state all --head <branch> --limit 1 --json url,number,state,isDraft
```

- [ ] **Step 3: Write the remote-branch recovery RED test**

Simulate no PR and a successful `git ls-remote` for the deterministic branch.
Assert `gh pr create --draft --head <branch> --base main` runs without applying
the Cloud diff again.

- [ ] **Step 4: Implement remote-branch recovery**

Use `git -C <target> ls-remote --exit-code --heads origin
refs/heads/<branch>`. Treat exit 2 as "absent"; other non-zero statuses are
errors.

- [ ] **Step 5: Write the fresh-publication RED test**

Assert the boundary sequence:

1. fetch `origin/main`;
2. add a detached temporary worktree;
3. `codex cloud apply <task-id>` in that worktree;
4. `git diff --check`;
5. require non-empty status;
6. add, commit `fix: KVO-NNN`, push
   `HEAD:refs/heads/<deterministic-branch>`;
7. remove the worktree;
8. create a draft PR with explicit head/base and links in its body.

Assert child environments do not contain `LINEAR_API_KEY` or
`TRIAGE_OPS_TOKEN`.

- [ ] **Step 6: Implement fresh publication and cleanup**

Use `mkdtemp()` under the configured state worktree root. Cleanup only via
`git worktree remove --force <exact-created-path>`; never recursively delete an
unresolved path.

- [ ] **Step 7: Cover failure boundaries**

Add independent tests for an apply failure, empty applied diff, and
`git diff --check` failure. Each must reject before push/PR creation.

- [ ] **Step 8: Run publisher tests GREEN**

```bash
npx vitest run test/codex-fix-publisher.test.ts
```

- [ ] **Step 9: Commit**

```bash
git add apps/colanode-bot/src/codex-fix/publisher.ts apps/colanode-bot/test/codex-fix-publisher.test.ts
git commit -m "feat(triage): publish Codex Cloud diffs as draft PRs"
```

---

### Task 5: Wire the CLI, configuration, and minute cron

**Files:**
- Create: `apps/colanode-bot/src/codex-fix/config.ts`
- Create: `apps/colanode-bot/src/codex-fix/run.ts`
- Create: `apps/colanode-bot/test/codex-fix-config.test.ts`
- Modify: `apps/colanode-bot/package.json`
- Create: `scripts/triage-codex-fix-cron.sh`
- Create: `apps/colanode-bot/test/triage-codex-fix-cron.test.ts`

**Interfaces:**
- Produces: npm script `triage:codex-fix`.
- Produces: trusted cron entrypoint `scripts/triage-codex-fix-cron.sh`.

- [ ] **Step 1: Write failing configuration tests**

Require the exact variables from design §8, validate state names/paths are
non-empty, and accept optional state/log/lock overrides.

- [ ] **Step 2: Implement config and CLI wiring**

The CLI constructs real `LinearApi`, `CloudTasks`, and `DraftPrPublisher`
instances, runs once, logs one JSON summary line, and exits non-zero on a
top-level failure.

- [ ] **Step 3: Write failing cron behavior tests**

Run the real shell script with a temporary fake `npm` executable:

- kill switch absent/false → exit 0 and no npm invocation;
- kill switch true → one npm invocation under a non-blocking lock;
- held lock → exit 0 and no npm invocation.

- [ ] **Step 4: Implement the cron wrapper**

The script sources `~/.config/triage/env`, defaults off, resolves the pinned
`TRIAGE_REPO`, sets cron-safe PATH, appends to the configured log, and invokes:

```text
npm --prefix "$REPO/apps/colanode-bot" run -s triage:codex-fix
```

- [ ] **Step 5: Run focused tests, ShellCheck, lint, and compile**

```bash
cd apps/colanode-bot
npm run test
npm run lint
npx tsc --noEmit -p tsconfig.json
cd ../..
shellcheck scripts/triage-codex-fix-cron.sh
```

- [ ] **Step 6: Commit**

```bash
git add apps/colanode-bot scripts/triage-codex-fix-cron.sh
git commit -m "feat(triage): run the Codex fix finalizer every minute"
```

---

### Task 6: Document, verify, publish, and stage the safe rollout

**Files:**
- Create: `docs/runbooks/kvota-codex-approved-fix.md`
- Modify during live rollout: `/home/bratmario/infra/README.md`

**Interfaces:**
- Produces: install, control-probe, failure-recovery, and rollback instructions.

- [ ] **Step 1: Write the runbook**

Include:

- all config variable names and locations, never values;
- exact cron line;
- first-run baseline expectation;
- controlled Triage → Approved probe;
- log, state, Cloud task, branch, PR, Linear comment/state checks;
- duplicate-task and apply-failure recovery;
- rollback via `CODEX_FIX_LOOP_ENABLED=false`;
- pinned-checkout repoint instructions.

- [ ] **Step 2: Run complete verification**

```bash
cd apps/colanode-bot
npm run test
npm run lint
npx tsc --noEmit -p tsconfig.json
cd ../..
shellcheck scripts/triage-codex-fix-cron.sh scripts/triage-sweep-guard.sh scripts/triage-sweep-cron.sh
git diff --check
git status --short
```

Expected: all commands exit 0; only intentional spec, plan, code, tests,
script, package, and runbook changes appear.

- [ ] **Step 3: Self-review against the design**

Check every design requirement, especially:

- no live mention in descriptions;
- initial rollout baseline cannot dispatch any pre-existing approved issue;
- task-time cutoff;
- duplicate-task hard stop;
- deterministic PR recovery;
- secret stripping;
- no merge/deploy behavior.

- [ ] **Step 4: Commit docs**

```bash
git add docs/superpowers docs/runbooks/kvota-codex-approved-fix.md
git commit -m "docs(triage): document the approved-fix Codex workflow"
```

- [ ] **Step 5: Push and open a draft implementation PR**

```bash
git push -u origin feat/approved-fix-codex-draft-pr
gh pr create \
  --repo AgasiArgent/colanode \
  --head feat/approved-fix-codex-draft-pr \
  --base feat/triage-u1-on-prod-line \
  --draft \
  --title "feat(triage): open draft PRs from approved Codex Cloud fixes" \
  --body-file <reviewed-body-file>
```

- [ ] **Step 6: Live rollout only after PR merge**

Repin `/home/bratmario/triage-brain`, add configuration with the kill switch
off, install cron, enable once, verify baseline-only behavior, re-project
descriptions, and perform one controlled issue transition. Update
`/home/bratmario/infra/README.md` in the same rollout.

---

## Plan self-review

- **Spec coverage:** Every in-scope behavior maps to Tasks 1–6. Historical
  baseline, transition detection, Cloud matching, publisher idempotency,
  security boundaries, cron, documentation, and rollout all have explicit
  tasks.
- **Placeholder scan:** No implementation step contains TBD/TODO or delegates
  unspecified error handling. Failure cases and command boundaries are named.
- **Type consistency:** `LinearFixIssue`, `CloudTask`, `DispatcherStateV1`,
  `CommandRunner`, and `DraftPrPublisher.publish()` are introduced once and
  consumed under the same names in later tasks.
