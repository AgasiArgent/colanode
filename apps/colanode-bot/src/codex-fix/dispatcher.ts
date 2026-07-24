import { CloudTasks } from './cloud';
import { CloudTask, DispatcherStateV1, IssueDispatchState } from './types';
import { LinearApi, LinearComment, LinearFixIssue } from '../linear/client';

export const DISPATCH_MARKER = '<!-- kvota:codex-fix-dispatch:v1 -->';
export const ERROR_MARKER = '<!-- kvota:codex-fix-error:v1 -->';
export const PR_MARKER = '<!-- kvota:codex-fix-pr:v1 -->';

const TERMINAL_FAILURE_STATUSES = new Set([
  'failed',
  'error',
  'cancelled',
  'canceled',
]);

export type DispatcherConfig = {
  teamId: string;
  approvedStateName: string;
  reviewStateName: string;
  githubRepo: string;
  cloudEnvironment: string;
};

export type PublishedDraftPr = {
  url: string;
  branch: string;
};

export type DraftPrPublisher = {
  publish(issue: LinearFixIssue, task: CloudTask): Promise<PublishedDraftPr>;
};

export type DispatcherDeps = {
  linear: Pick<
    LinearApi,
    | 'issuesByState'
    | 'createComment'
    | 'workflowStateByName'
    | 'updateIssueState'
  >;
  cloud: Pick<CloudTasks, 'list'>;
  publisher: DraftPrPublisher;
  state: {
    load(): Promise<DispatcherStateV1 | null>;
    save(state: DispatcherStateV1): Promise<void>;
  };
  now(): Date;
};

export type RunSummary = {
  approved: number;
  baselined: number;
  recovered: number;
  dispatched: number;
  bound: number;
  pending: number;
  blocked: number;
  noChanges: number;
  published: number;
  failed: number;
};

const latestCommentWithMarker = (
  comments: LinearComment[],
  marker: string
): LinearComment | null =>
  comments.reduce<LinearComment | null>((latest, comment) => {
    if (!comment.body.includes(marker)) {
      return latest;
    }
    if (
      latest === null ||
      Date.parse(comment.createdAt) > Date.parse(latest.createdAt)
    ) {
      return comment;
    }
    return latest;
  }, null);

const dispatchBody = (
  githubRepo: string
): string => `@Codex implement this approved issue in \`${githubRepo}\`.

Read the complete issue, linked issues, and attached evidence. Make the smallest
correct change, add or update regression tests, and run the relevant checks.
Leave a PR-ready diff; a deterministic finalizer will open the draft PR.

${DISPATCH_MARKER}`;

const errorBody = (state: IssueDispatchState): string => {
  if (state.outcome === 'no_changes') {
    return `Codex Cloud finished without code changes, so no PR was opened.

Cloud task: ${state.taskUrl ?? state.taskId ?? 'unknown'}

${ERROR_MARKER}`;
  }

  return `Codex draft-PR automation stopped safely and opened no PR.

Reason: ${state.lastError ?? 'unknown automation error'}
${state.taskUrl ? `\nCloud task: ${state.taskUrl}` : ''}

${ERROR_MARKER}`;
};

const prBody = (
  state: IssueDispatchState
): string => `Draft PR ready: ${state.prUrl}

Codex Cloud task: ${state.taskUrl}

Review the issue context and diff before merging.

${PR_MARKER}`;

const withIssue = (
  state: DispatcherStateV1,
  issueState: IssueDispatchState
): DispatcherStateV1 => ({
  ...state,
  issues: {
    ...state.issues,
    [issueState.issueId]: issueState,
  },
});

const taskMatchesIssue = (
  task: CloudTask,
  issueState: IssueDispatchState,
  cloudEnvironment: string
): boolean =>
  task.environmentLabel === cloudEnvironment &&
  task.title.startsWith(`Linear Mention: ${issueState.identifier}:`) &&
  Date.parse(task.updatedAt) >= Date.parse(issueState.dispatchedAt);

const hasMarker = (issue: LinearFixIssue, marker: string): boolean =>
  issue.comments.some((comment) => comment.body.includes(marker));

export const runCodexFixDispatcher = async (
  config: DispatcherConfig,
  deps: DispatcherDeps
): Promise<RunSummary> => {
  const approvedIssues = await deps.linear.issuesByState(
    config.teamId,
    config.approvedStateName
  );
  const currentApprovedIds = approvedIssues.map((issue) => issue.id);
  let state = await deps.state.load();

  if (state === null) {
    state = {
      version: 1,
      initializedAt: deps.now().toISOString(),
      approvedIssueIds: currentApprovedIds,
      issues: {},
    };
    await deps.state.save(state);
    return {
      approved: approvedIssues.length,
      baselined: approvedIssues.length,
      recovered: 0,
      dispatched: 0,
      bound: 0,
      pending: 0,
      blocked: 0,
      noChanges: 0,
      published: 0,
      failed: 0,
    };
  }

  let recovered = 0;
  let dispatched = 0;
  let bound = 0;
  let pending = 0;
  let blocked = 0;
  let noChanges = 0;
  let published = 0;
  let failed = 0;
  const previouslyApproved = new Set(state.approvedIssueIds);

  const persistIssue = async (
    issueState: IssueDispatchState
  ): Promise<void> => {
    state = withIssue(state!, issueState);
    await deps.state.save(state);
  };

  for (const issue of approvedIssues) {
    if (state.issues[issue.id]) {
      continue;
    }
    const marker = latestCommentWithMarker(issue.comments, DISPATCH_MARKER);
    if (marker) {
      await persistIssue({
        issueId: issue.id,
        identifier: issue.identifier,
        dispatchCommentId: marker.id,
        dispatchedAt: marker.createdAt,
        outcome: 'pending',
      });
      recovered += 1;
      continue;
    }
    if (!previouslyApproved.has(issue.id)) {
      const comment = await deps.linear.createComment(
        issue.id,
        dispatchBody(config.githubRepo)
      );
      await persistIssue({
        issueId: issue.id,
        identifier: issue.identifier,
        dispatchCommentId: comment.id,
        dispatchedAt: comment.createdAt,
        outcome: 'pending',
      });
      dispatched += 1;
    }
  }

  const activeIssues = approvedIssues.filter(
    (issue) => state!.issues[issue.id] !== undefined
  );
  const needsCloudTasks = activeIssues.some(
    (issue) => state!.issues[issue.id]?.outcome === 'pending'
  );
  const tasks = needsCloudTasks ? await deps.cloud.list() : [];
  let reviewStateId: string | null = null;

  const ensureErrorComment = async (
    issue: LinearFixIssue,
    issueState: IssueDispatchState
  ): Promise<void> => {
    if (!hasMarker(issue, ERROR_MARKER)) {
      await deps.linear.createComment(issue.id, errorBody(issueState));
    }
  };

  const ensurePrCompletion = async (
    issue: LinearFixIssue,
    issueState: IssueDispatchState
  ): Promise<void> => {
    if (!issueState.prUrl || !issueState.taskUrl) {
      throw new Error(`${issue.identifier} has an incomplete pr_opened state`);
    }
    if (!hasMarker(issue, PR_MARKER)) {
      await deps.linear.createComment(issue.id, prBody(issueState));
    }
    if (reviewStateId === null) {
      const reviewState = await deps.linear.workflowStateByName(
        config.teamId,
        config.reviewStateName
      );
      if (!reviewState) {
        throw new Error(
          `Linear workflow state not found: ${config.reviewStateName}`
        );
      }
      reviewStateId = reviewState.id;
    }
    await deps.linear.updateIssueState(issue.id, reviewStateId);
  };

  for (const issue of activeIssues) {
    let issueState = state.issues[issue.id]!;

    if (issueState.outcome === 'pr_opened') {
      await ensurePrCompletion(issue, issueState);
      continue;
    }
    if (
      issueState.outcome === 'blocked' ||
      issueState.outcome === 'no_changes' ||
      issueState.outcome === 'failed'
    ) {
      await ensureErrorComment(issue, issueState);
      continue;
    }

    let task = issueState.taskId
      ? tasks.find((candidate) => candidate.id === issueState.taskId)
      : undefined;

    if (!issueState.taskId) {
      const candidates = tasks.filter((candidate) =>
        taskMatchesIssue(candidate, issueState, config.cloudEnvironment)
      );
      if (candidates.length > 1) {
        issueState = {
          ...issueState,
          outcome: 'blocked',
          lastError: `multiple matching Codex Cloud tasks: ${candidates
            .map((candidate) => candidate.id)
            .join(', ')}`,
        };
        await persistIssue(issueState);
        await ensureErrorComment(issue, issueState);
        blocked += 1;
        continue;
      }
      if (candidates.length === 1) {
        task = candidates[0];
        issueState = {
          ...issueState,
          taskId: task.id,
          taskUrl: task.url,
        };
        await persistIssue(issueState);
        bound += 1;
      }
    }

    if (!task) {
      pending += 1;
      continue;
    }

    const normalizedStatus = task.status.toLowerCase();
    if (TERMINAL_FAILURE_STATUSES.has(normalizedStatus)) {
      issueState = {
        ...issueState,
        outcome: 'failed',
        lastError: `Codex Cloud task ended with status ${task.status}`,
      };
      await persistIssue(issueState);
      await ensureErrorComment(issue, issueState);
      failed += 1;
      continue;
    }
    if (normalizedStatus !== 'ready') {
      pending += 1;
      continue;
    }
    if (task.summary.filesChanged === 0) {
      issueState = {
        ...issueState,
        outcome: 'no_changes',
      };
      await persistIssue(issueState);
      await ensureErrorComment(issue, issueState);
      noChanges += 1;
      continue;
    }

    let pr: PublishedDraftPr;
    try {
      pr = await deps.publisher.publish(issue, task);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      issueState = {
        ...issueState,
        outcome: 'failed',
        lastError: message.slice(0, 500),
      };
      await persistIssue(issueState);
      await ensureErrorComment(issue, issueState);
      failed += 1;
      continue;
    }

    issueState = {
      ...issueState,
      branch: pr.branch,
      outcome: 'pr_opened',
      prUrl: pr.url,
    };
    await persistIssue(issueState);
    await ensurePrCompletion(issue, issueState);
    published += 1;
  }

  state = {
    ...state,
    approvedIssueIds: currentApprovedIds,
  };
  await deps.state.save(state);

  return {
    approved: approvedIssues.length,
    baselined: 0,
    recovered,
    dispatched,
    bound,
    pending,
    blocked,
    noChanges,
    published,
    failed,
  };
};
