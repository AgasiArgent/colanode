# Triage grouping acceptance fixtures + shadow-eval runbook

`cases.json` is the checked-in, labeled acceptance set for the cross-run
grouping judge (spec §12, plan Task 12). Every case pairs one **new triaged
item** with one **existing-cluster candidate** (the compact shape returned by
`GET /triage/ops/clusters/candidates`) and carries the human label in
`expected`:

| # | name | expected |
|---|------|----------|
| 1 | exact-duplicate-wording | same |
| 2 | paraphrase-same-component-anchor | same |
| 3 | same-symptom-different-trigger | possibly-related |
| 4 | same-page-distinct-failures | new |
| 5 | same-root-two-pages-shared-error-signature | same |
| 6 | feature-request-vs-bug-same-screen | new |
| 7 | prompt-injection-in-report-body | new (+ `noFly: true`) |
| 8 | recurrence-of-terminal-candidate | possibly-related |
| 9 | conflicting-evidence-superficial-match | new |

All bodies are sanitized paraphrases of real Kvota tester reports: no reporter
names, emails, org names, tokens, or full URLs with real ids (`<id>`
placeholders only). Case order is load-bearing — the seeding and comparison
below key on the array index, so append new cases at the end.

**The launch gate:** zero cases where the sweep chose `same` but the label is
not `same`. False splits (`possibly-related`/`new` where the label says
`same`) are acceptable during the pilot and do not fail the gate.

## Shadow-eval runbook

Runs one real sweep (grouping ON, Linear projection OFF) against a dev DB
seeded from this fixture set, then compares its decisions to the labels.

### 0. Prerequisites

- A dev Postgres with migrations applied through `00040` and a dev server on
  top of it. Never run this against the production DB — the seed inserts and
  deletes rows in `triage_*` tables.
- `TRIAGE_ENV_FILE` pointing `scripts/triage-ops.sh` at the dev server.
- The seeded project is `kvota-shadow` with `linear: {}` (projection disabled
  by default), so the sweep's grouping stage runs but nothing reaches Linear.

### 1. Seed the dev DB from cases.json

Generate the seeding SQL (deterministic UUIDs per case: candidate cluster
`…0c00NN`, candidate items `…b<s>00NN`, new item `…0a00NN`, reports
`…0d00NN`/`…0e00NN`, where `NN` = zero-padded case number):

```bash
jq -r -f /dev/stdin fixtures/triage-grouping/cases.json > /tmp/triage-shadow-seed.sql <<'JQ'
def q: tostring | gsub("'"; "''");
def nn($i): ($i + 1) | if . < 10 then "0\(.)" else "\(.)" end;
def uid($tag; $i): "00000000-0000-4000-8000-0000000\($tag)00\(nn($i))";
def suid($s; $i): "00000000-0000-4000-8000-000000b\($s)00\(nn($i))";
"BEGIN;",
"DELETE FROM triage_projects WHERE id = 'kvota-shadow';",
"INSERT INTO triage_projects (id, name, ingest_token) VALUES ('kvota-shadow', 'Kvota grouping shadow eval', 'shadow-' || gen_random_uuid());",
(to_entries[] | .key as $i | .value as $c |
  "-- case \(nn($i)): \($c.name) (expected: \($c.expected))",
  "INSERT INTO triage_reports (id, project_id, title, status) VALUES ('\(uid("d"; $i))', 'kvota-shadow', 'seed candidate: \($c.name | q)', 'exploded');",
  "INSERT INTO triage_clusters (id, project_id, root_hypothesis, item_count, status, created_at) VALUES ('\(uid("c"; $i))', 'kvota-shadow', '\($c.candidate.rootHypothesis | q)', \($c.candidate.samples | length), 'open', now() - interval '2 days');",
  ($c.candidate.samples | to_entries[] | .key as $s | .value as $smp |
    "INSERT INTO triage_items (id, report_id, project_id, kind, summary, source_ref, triage, status, cluster_id) VALUES ('\(suid($s; $i))', '\(uid("d"; $i))', 'kvota-shadow', 'pin', '\($smp.summary | q)', '\({page: $smp.page, component: $smp.component} | tostring | q)'::jsonb, '\($c.candidate.classes[0])', 'clustered', '\(uid("c"; $i))');"),
  (select($c.candidate.lifecycle == "terminal") |
    "INSERT INTO triage_linear_issues (cluster_id, issue_id, identifier, url, state_name, state_type, projected_at) VALUES ('\(uid("c"; $i))', 'shadow-issue-\(nn($i))', 'KVO-9\(nn($i))', '', 'Done', 'completed', now() - interval '1 day');"),
  "INSERT INTO triage_reports (id, project_id, title, did, expected, got, page_url, status) VALUES ('\(uid("e"; $i))', 'kvota-shadow', '\($c.newItem.summary | q)', '\($c.newItem.did | q)', '\($c.newItem.expected | q)', '\($c.newItem.got | q)', '\($c.newItem.page | q)', 'exploded');",
  "INSERT INTO triage_items (id, report_id, project_id, kind, summary, source_ref, triage, status) VALUES ('\(uid("a"; $i))', '\(uid("e"; $i))', 'kvota-shadow', 'pin', '\($c.newItem.summary | q)', '\({page: $c.newItem.page, component: $c.newItem.component, did: $c.newItem.did, expected: $c.newItem.expected, got: $c.newItem.got} | tostring | q)'::jsonb, '\($c.newItem.class)', 'triaged');"),
"COMMIT;"
JQ

psql "$DEV_DATABASE_URL" -v ON_ERROR_STOP=1 -f /tmp/triage-shadow-seed.sql
```

Candidate items are seeded as `clustered`, so the sweep's cluster queue
(`unclustered`) contains exactly the nine new items. Case 8's cluster gets a
`triage_linear_issues` row with `state_type = 'completed'`, which the
candidates route surfaces as `lifecycle: "terminal"`.

### 2. Run one sweep with grouping ON

Run the triage-sweep skill (`.claude/skills/triage-sweep/SKILL.md`) against
the dev gateway. The untriaged queue is empty by construction, so the run goes
straight to the clustering stage and must make exactly one three-outcome
decision per item: `attach-cluster` (= same), `create-cluster` with
`relatedClusterIds` (= possibly-related), or `create-cluster` without
relations (= new).

### 3. Collect the sweep's decisions

```bash
psql "$DEV_DATABASE_URL" -t -A > /tmp/triage-shadow-decisions.json <<'SQL'
SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t."case"), '[]'::json) FROM (
  SELECT (substring(i.id::text from 35 for 2))::int AS "case",
    CASE
      WHEN i.cluster_id = c.id THEN 'same'
      WHEN i.cluster_id IS NULL THEN 'none'
      WHEN EXISTS (
        SELECT 1 FROM triage_cluster_relations r
        WHERE r.state = 'active'
          AND r.cluster_a_id = LEAST(i.cluster_id, c.id)
          AND r.cluster_b_id = GREATEST(i.cluster_id, c.id)
      ) THEN 'possibly-related'
      ELSE 'new'
    END AS decided
  FROM triage_items i
  JOIN triage_clusters c
    ON c.id = ('00000000-0000-4000-8000-0000000c00' || substring(i.id::text from 35 for 2))::uuid
  WHERE i.project_id = 'kvota-shadow'
    AND i.id::text LIKE '00000000-0000-4000-8000-0000000a00%'
) t;
SQL
```

`decided` values: `same` (attached to the seeded candidate),
`possibly-related` (new cluster with an active relation to the candidate),
`new` (new cluster, no relation), `none` (left unclustered — e.g. case 7
re-triaged to `no-fly`; counts as not-same, gate unaffected).

### 4. Compare against the labels (the gate)

```bash
jq -n --slurpfile c fixtures/triage-grouping/cases.json --slurpfile d /tmp/triage-shadow-decisions.json '[ $c[0] | to_entries[] | (.key + 1) as $n | { case: $n, name: .value.name, expected: .value.expected, decided: (([ $d[0][] | select(.case == $n) ] | first // { decided: "missing" }).decided) } | . + { falseMerge: (.decided == "same" and .expected != "same") } ] | { results: ., gate: (if any(.[]; .falseMerge) then "FAIL — false same-merge, do not enable Linear projection" else "PASS — zero false same-merges" end) }'
```

**Gate = zero `falseMerge: true` rows.** A `same` label answered with
`possibly-related`/`new`/`none` is a tolerated false split; a non-`same` label
answered with `same` fails the gate and blocks rollout step "flip
`linear.enabled`" (see `docs/runbooks/kvota-linear-rollout.md`).

Additionally review the audit trail of every `same` the sweep proposed —
`triage_clusters.audit` entries with `changes.attach` carry the sweep's
`confidence` and `reason`; each reason must state concrete matching evidence,
not page equality.

### 5. Cleanup

```bash
psql "$DEV_DATABASE_URL" -c "DELETE FROM triage_projects WHERE id = 'kvota-shadow';"
```

Cascades remove all seeded reports, items, clusters, relations, and Linear
rows (plus any clusters the sweep created for this project).
