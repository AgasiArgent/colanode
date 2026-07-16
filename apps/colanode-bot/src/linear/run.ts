import { pathToFileURL } from 'node:url';

import { LinearApi, LinearIssue } from './client';
import { loadLinearProjectorConfig } from './config';
import { buildMachineBlock, mergeDescription } from './description';
import { LinearOpsClient, ProjectLinearConfig } from './ops-client';
import { QueueCluster } from './types';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // Linear Free-plan per-file limit

export type ProjectorPhase = 'pre' | 'post';

// Pick keeps the deps structurally fakeable in tests while the CLI wires in
// the real LinearOpsClient / LinearApi instances.
export type ProjectorDeps = {
  ops: Pick<
    LinearOpsClient,
    'listProjects' | 'getQueue' | 'recordIssue' | 'reconcile' | 'fetchArtifact'
  >;
  linear: Pick<
    LinearApi,
    | 'issueById'
    | 'ensureIssue'
    | 'updateIssueDescription'
    | 'uploadFile'
    | 'createRelation'
    | 'issuesUpdatedSince'
  >;
  log: (line: string) => void;
};

const extensionOf = (contentType: string): string =>
  contentType.split('/')[1] ?? 'bin';

/**
 * Uploads the cluster's screenshot artifacts that have no recorded asset URL
 * yet — `assets` starts from the stored URLs, so each artifact uploads once.
 * Oversized files (spec §8: 10 MB Free-plan cap) are skipped and stay out of
 * the map; the description builder renders the omission note for them.
 * Mutates `assets` in place so URLs uploaded before a mid-run throw still
 * reach the caller's error record — a returned map would be lost on throw
 * and the next run would re-upload (duplicate files in Linear).
 */
const uploadMissingArtifacts = async (
  cluster: QueueCluster,
  assets: Record<string, string>,
  deps: ProjectorDeps
): Promise<void> => {
  for (const report of cluster.reports) {
    for (const artifact of report.artifacts) {
      if (artifact.kind !== 'screenshot' || assets[artifact.id]) {
        continue;
      }
      const { bytes, contentType } = await deps.ops.fetchArtifact(
        report.id,
        artifact.id
      );
      if (bytes.byteLength > MAX_UPLOAD_BYTES) {
        continue;
      }
      assets[artifact.id] = await deps.linear.uploadFile(
        bytes,
        contentType,
        `${artifact.id}.${extensionOf(contentType)}`
      );
    }
  }
};

/** Item triage values → configured Linear label ids (unknown values skip). */
const labelIdsOf = (
  cluster: QueueCluster,
  labels: Record<string, string>
): string[] => {
  const ids = new Set<string>();
  for (const item of cluster.items) {
    const labelId = item.triage ? labels[item.triage] : undefined;
    if (labelId) {
      ids.add(labelId);
    }
  }
  return [...ids];
};

const projectCluster = async (
  cluster: QueueCluster,
  assets: Record<string, string>,
  linearConfig: ProjectLinearConfig,
  teamId: string,
  deps: ProjectorDeps
): Promise<{ created: boolean; relations: number }> => {
  await uploadMissingArtifacts(cluster, assets, deps);
  const machineBlock = buildMachineBlock(cluster, assets);

  // Re-fetch immediately before writing (spec §9): the merge always starts
  // from the CURRENT description, so human edits are never overwritten stale.
  const recordedIssueId = cluster.linear?.issueId;
  const fresh = recordedIssueId
    ? await deps.linear.issueById(recordedIssueId)
    : null;

  let issue: LinearIssue;
  let created = false;
  if (fresh) {
    await deps.linear.updateIssueDescription(
      fresh.id,
      mergeDescription(fresh.description, machineBlock)
    );
    issue = fresh;
  } else {
    issue = await deps.linear.ensureIssue({
      // The client-supplied issue id IS the cluster id — deterministic, so a
      // retry after a lost `recordIssue` finds the same issue (lookup-first).
      // `||` not `??`: a failed first attempt records issueId '' and the
      // queue serves it back — it must fall through to the cluster id.
      id: recordedIssueId || cluster.id,
      teamId,
      title: cluster.rootHypothesis,
      description: mergeDescription(null, machineBlock),
      labelIds: labelIdsOf(cluster, linearConfig.labels ?? {}),
    });
    created = !recordedIssueId;
  }

  let relations = 0;
  for (const relation of cluster.relations) {
    // The queue serves active relations only; a non-null identifier means the
    // pair is projected and not aliased. Its issue id equals its cluster id
    // (the same client-supplied-id invariant used in ensureIssue above).
    if (relation.state !== 'active' || !relation.otherIdentifier) {
      continue;
    }
    await deps.linear.createRelation(issue.id, relation.otherClusterId);
    relations += 1;
  }

  await deps.ops.recordIssue(cluster.id, {
    issueId: issue.id,
    identifier: issue.identifier,
    url: issue.url,
    stateName: issue.stateName,
    stateType: issue.stateType,
    artifactAssets: assets,
  });

  return { created, relations };
};

/**
 * Deterministic projector run (spec §5.3): `pre` reconciles human Linear
 * decisions into the triage store before the sweep groups anything; `post`
 * reconciles again (fresh pre-write state, spec §9) and then projects every
 * queued cluster. No LLM anywhere — plain fetch against the ops API + Linear.
 */
export const runProjector = async (
  phase: ProjectorPhase,
  deps: ProjectorDeps
): Promise<void> => {
  const projects = await deps.ops.listProjects();

  for (const project of projects) {
    try {
      const { project: opsProject } = await deps.ops.getQueue(project.id);
      const linearConfig = opsProject.linear;
      const teamId = linearConfig.teamId;
      if (linearConfig.enabled !== true || !teamId) {
        continue;
      }

      // Reconcile in BOTH phases. The ops API stores but does not expose the
      // sync cursor, so the fetch window starts at the cutover — reconcile is
      // idempotent and the Free-plan issue cap keeps the window cheap.
      const cursorTs = new Date().toISOString();
      const changes = await deps.linear.issuesUpdatedSince(
        teamId,
        linearConfig.cutoverAt ?? new Date(0).toISOString()
      );
      await deps.ops.reconcile(project.id, {
        cursorTs,
        issues: changes,
        dismissedRelations: [],
      });

      let created = 0;
      let updated = 0;
      let relations = 0;
      let failures = 0;

      if (phase === 'post') {
        // Fresh queue AFTER reconcile: clusters aliased a moment ago must
        // not be projected.
        const queue = await deps.ops.getQueue(project.id);
        for (const cluster of queue.clusters) {
          // Hoisted past the try so uploads that succeeded before a failure
          // are still recorded — otherwise the next run re-uploads them.
          const assets = { ...(cluster.linear?.artifactAssets ?? {}) };
          try {
            const result = await projectCluster(
              cluster,
              assets,
              linearConfig,
              teamId,
              deps
            );
            if (result.created) {
              created += 1;
            } else {
              updated += 1;
            }
            relations += result.relations;
          } catch (error) {
            const message =
              error instanceof Error ? error.message : String(error);
            const code = /250|limit|payment/i.test(message)
              ? 'issue-cap-or-plan-limit'
              : 'projection-failed';
            // On errorCode the ops route updates only error columns (+ the
            // assets map) — previously recorded issue state stays intact.
            await deps.ops.recordIssue(cluster.id, {
              issueId: cluster.linear?.issueId ?? '',
              artifactAssets: assets,
              errorCode: code,
              errorMessage: message.slice(0, 500),
            });
            failures += 1;
            continue;
          }
        }
      }

      // Run summary line per spec §10.
      deps.log(
        `linear: ${project.id} reconciled=${changes.length} created=${created} updated=${updated} relations=${relations} failures=${failures}`
      );
    } catch (error) {
      // Per-project isolation: one broken project never blocks the others.
      const message = error instanceof Error ? error.message : String(error);
      deps.log(`linear: ${project.id} failed: ${message}`);
    }
  }
};

const parsePhase = (argv: string[]): ProjectorPhase => {
  const index = argv.indexOf('--phase');
  const value = index >= 0 ? argv[index + 1] : 'post';
  if (value !== 'pre' && value !== 'post') {
    throw new Error(`invalid --phase: ${value} (expected pre|post)`);
  }
  return value;
};

// Guarded so the test can import runProjector without starting a run.
const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const config = loadLinearProjectorConfig();
  const deps: ProjectorDeps = {
    ops: new LinearOpsClient(config.opsUrl, config.opsToken),
    linear: new LinearApi(config.linearApiKey),
    log: console.log,
  };
  runProjector(parsePhase(process.argv.slice(2)), deps)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('[linear] projector failed:', error);
      process.exit(1);
    });
}
