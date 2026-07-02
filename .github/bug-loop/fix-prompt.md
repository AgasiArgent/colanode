You are the fix step of an automated bug loop. Issue: {{ISSUE}}. Attempt: {{ATTEMPT}}.
Read `gh issue view {{ISSUE}} --comments`. The repro comment contains a browser-test-v2 manifest (yaml block).

Workflow (strict):
1. `git checkout -b bug-loop/issue-{{ISSUE}}` from origin/main.
2. Save the manifest verbatim to `tests/auto-repro/issue-{{ISSUE}}.yaml` (keep `__BT_BASE_URL__`).
3. Root-cause the bug (systematic-debugging discipline: trace, don't guess). Write a REGRESSION TEST first
   (vitest, colocated with the code under test) that fails on current code for the bug's reason.
4. Implement the minimal root-cause fix. No refactors, no drive-by changes. Target ≤150 changed lines,
   only under apps/web/, packages/ui/, packages/client/.
5. `npx turbo run test --affected -- --watch false` must pass.
6. Commit (fix + test + manifest), push, then:
   `gh pr create --title "fix: <short summary> [bug-loop#{{ISSUE}}]" --body "Fixes #{{ISSUE}}. Automated fix, attempt {{ATTEMPT}}. Repro manifest: tests/auto-repro/issue-{{ISSUE}}.yaml"`
7. If {{ATTEMPT}} is 1: `gh pr edit --add-label auto-fix-attempt-1`.
   If {{ATTEMPT}} is 2+: `gh pr edit --add-label auto-fix-attempt-2 --add-label needs-human` — a human merges; do NOT enable auto-merge.
Rules: never push to main; never touch .github/, migrations, auth, payment code; if you cannot find the root
cause, comment your findings on the issue, add label needs-human, and stop.
