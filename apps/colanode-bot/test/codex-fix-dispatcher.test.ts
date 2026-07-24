import { describe, expect, it, vi } from 'vitest';

import {
  DISPATCH_MARKER,
  ERROR_MARKER,
  PR_MARKER,
  DispatcherConfig,
  DispatcherDeps,
  runCodexFixDispatcher,
} from '../src/codex-fix/dispatcher';
import {
  CloudTask,
  DispatcherStateV1,
  IssueDispatchState,
} from '../src/codex-fix/types';
import { LinearFixIssue } from '../src/linear/client';

const CONFIG: DispatcherConfig = {
  teamId: 'team-kvo',
  approvedStateName: 'Approved for fix',
  reviewStateName: 'In Review',
  githubRepo: 'AgasiArgent/kvota-onestack',
  cloudEnvironment: 'kvota-onestack',
};

const approved = (
  identifier: string,
  comments: LinearFixIssue['comments'] = []
): LinearFixIssue => ({
  id: `issue-${identifier}`,
  identifier,
  title: `Title ${identifier}`,
  url: `https://linear.app/issue/${identifier}`,
  stateName: 'Approved for fix',
  comments,
});

const cloudTask = (
  identifier: string,
  overrides: Partial<CloudTask> = {}
): CloudTask => ({
  id: `task-${identifier}`,
  url: `https://chatgpt.com/codex/tasks/task-${identifier}`,
  title: `Linear Mention: ${identifier}: Title ${identifier}`,
  status: 'ready',
  updatedAt: '2026-07-24T10:10:00.000Z',
  environmentId: null,
  environmentLabel: 'kvota-onestack',
  summary: {
    filesChanged: 2,
    linesAdded: 8,
    linesRemoved: 3,
  },
  isReview: false,
  attemptTotal: 1,
  ...overrides,
});

const stateWith = (
  approvedIssueIds: string[],
  issues: Record<string, IssueDispatchState> = {}
): DispatcherStateV1 => ({
  version: 1,
  initializedAt: '2026-07-24T09:00:00.000Z',
  approvedIssueIds,
  issues,
});

const pendingDispatch = (identifier: string): IssueDispatchState => ({
  issueId: `issue-${identifier}`,
  identifier,
  dispatchCommentId: `comment-${identifier}`,
  dispatchedAt: '2026-07-24T10:00:00.000Z',
  outcome: 'pending',
});

const makeHarness = (
  issues: LinearFixIssue[],
  initialState: DispatcherStateV1 | null,
  tasks: CloudTask[] = []
) => {
  let storedState = initialState;
  let commentSequence = 0;
  const linear = {
    issuesByState: vi.fn().mockResolvedValue(issues),
    createComment: vi
      .fn()
      .mockImplementation(async (_issueId: string, body: string) => ({
        id: `created-comment-${++commentSequence}`,
        body,
        createdAt: '2026-07-24T10:00:00.000Z',
      })),
    workflowStateByName: vi.fn().mockResolvedValue({
      id: 'review-state',
      name: 'In Review',
      type: 'started',
    }),
    updateIssueState: vi.fn().mockResolvedValue(undefined),
  };
  const cloud = {
    list: vi.fn().mockResolvedValue(tasks),
  };
  const publisher = {
    publish: vi.fn().mockResolvedValue({
      url: 'https://github.com/AgasiArgent/kvota-onestack/pull/999',
      branch: 'codex/kvo-109-task',
    }),
  };
  const deps: DispatcherDeps = {
    linear,
    cloud,
    publisher,
    state: {
      load: vi.fn().mockImplementation(async () => storedState),
      save: vi.fn().mockImplementation(async (next: DispatcherStateV1) => {
        storedState = structuredClone(next);
      }),
    },
    now: () => new Date('2026-07-24T10:00:00.000Z'),
  };

  return {
    deps,
    linear,
    cloud,
    publisher,
    getState: () => storedState,
  };
};

describe('runCodexFixDispatcher', () => {
  it('baselines every currently approved issue without delegating', async () => {
    const harness = makeHarness([approved('KVO-4'), approved('KVO-6')], null);

    const summary = await runCodexFixDispatcher(CONFIG, harness.deps);

    expect(summary).toEqual(
      expect.objectContaining({ baselined: 2, dispatched: 0 })
    );
    expect(harness.linear.createComment).not.toHaveBeenCalled();
    expect(harness.cloud.list).not.toHaveBeenCalled();
    expect(harness.getState()?.approvedIssueIds).toEqual([
      'issue-KVO-4',
      'issue-KVO-6',
    ]);
  });

  it('delegates exactly one newly approved issue with a marked prompt', async () => {
    const harness = makeHarness(
      [approved('KVO-4'), approved('KVO-109')],
      stateWith(['issue-KVO-4'])
    );

    const summary = await runCodexFixDispatcher(CONFIG, harness.deps);

    expect(summary.dispatched).toBe(1);
    expect(harness.linear.createComment).toHaveBeenCalledTimes(1);
    const body = harness.linear.createComment.mock.calls[0]![1];
    expect(body.match(/@Codex/g)).toHaveLength(1);
    expect(body).toContain('AgasiArgent/kvota-onestack');
    expect(body).toContain(DISPATCH_MARKER);
    expect(harness.getState()?.issues['issue-KVO-109']).toEqual(
      expect.objectContaining({
        identifier: 'KVO-109',
        dispatchCommentId: 'created-comment-1',
        outcome: 'pending',
      })
    );
  });

  it('recovers an accepted dispatch marker without mentioning Codex again', async () => {
    const issue = approved('KVO-109', [
      {
        id: 'linear-comment',
        body: `@Codex fix this\n${DISPATCH_MARKER}`,
        createdAt: '2026-07-24T09:59:00.000Z',
      },
    ]);
    const harness = makeHarness([issue], stateWith([], {}));

    await runCodexFixDispatcher(CONFIG, harness.deps);

    expect(harness.linear.createComment).not.toHaveBeenCalled();
    expect(harness.getState()?.issues[issue.id]).toEqual(
      expect.objectContaining({
        dispatchCommentId: 'linear-comment',
        dispatchedAt: '2026-07-24T09:59:00.000Z',
      })
    );
  });

  it('ignores historical and wrong-environment tasks', async () => {
    const issue = approved('KVO-109');
    const harness = makeHarness(
      [issue],
      stateWith([issue.id], {
        [issue.id]: pendingDispatch(issue.identifier),
      }),
      [
        cloudTask('KVO-109', {
          id: 'historical',
          updatedAt: '2026-07-24T09:59:59.000Z',
        }),
        cloudTask('KVO-109', {
          id: 'wrong-environment',
          environmentLabel: 'another-repo',
        }),
      ]
    );

    const summary = await runCodexFixDispatcher(CONFIG, harness.deps);

    expect(summary.pending).toBe(1);
    expect(harness.getState()?.issues[issue.id]?.taskId).toBeUndefined();
    expect(harness.publisher.publish).not.toHaveBeenCalled();
  });

  it('binds one matching task and leaves an unready task pending', async () => {
    const issue = approved('KVO-109');
    const task = cloudTask('KVO-109', { status: 'running' });
    const harness = makeHarness(
      [issue],
      stateWith([issue.id], {
        [issue.id]: pendingDispatch(issue.identifier),
      }),
      [task]
    );

    const summary = await runCodexFixDispatcher(CONFIG, harness.deps);

    expect(summary.bound).toBe(1);
    expect(summary.pending).toBe(1);
    expect(harness.getState()?.issues[issue.id]).toEqual(
      expect.objectContaining({ taskId: task.id, taskUrl: task.url })
    );
    expect(harness.publisher.publish).not.toHaveBeenCalled();
  });

  it('blocks two eligible tasks and comments once without publishing', async () => {
    const issue = approved('KVO-109');
    const harness = makeHarness(
      [issue],
      stateWith([issue.id], {
        [issue.id]: pendingDispatch(issue.identifier),
      }),
      [
        cloudTask('KVO-109', { id: 'task-a' }),
        cloudTask('KVO-109', { id: 'task-b' }),
      ]
    );

    const summary = await runCodexFixDispatcher(CONFIG, harness.deps);

    expect(summary.blocked).toBe(1);
    expect(harness.getState()?.issues[issue.id]?.outcome).toBe('blocked');
    expect(harness.linear.createComment).toHaveBeenCalledWith(
      issue.id,
      expect.stringContaining(ERROR_MARKER)
    );
    expect(harness.publisher.publish).not.toHaveBeenCalled();
  });

  it('records a ready task with no changed files without opening a PR', async () => {
    const issue = approved('KVO-109');
    const task = cloudTask('KVO-109', {
      summary: { filesChanged: 0, linesAdded: 0, linesRemoved: 0 },
    });
    const harness = makeHarness(
      [issue],
      stateWith([issue.id], {
        [issue.id]: {
          ...pendingDispatch(issue.identifier),
          taskId: task.id,
          taskUrl: task.url,
        },
      }),
      [task]
    );

    const summary = await runCodexFixDispatcher(CONFIG, harness.deps);

    expect(summary.noChanges).toBe(1);
    expect(harness.getState()?.issues[issue.id]?.outcome).toBe('no_changes');
    expect(harness.publisher.publish).not.toHaveBeenCalled();
    expect(harness.linear.createComment).toHaveBeenCalledWith(
      issue.id,
      expect.stringContaining(ERROR_MARKER)
    );
  });

  it('publishes a ready diff, comments the PR, and moves to In Review', async () => {
    const issue = approved('KVO-109');
    const task = cloudTask('KVO-109');
    const harness = makeHarness(
      [issue],
      stateWith([issue.id], {
        [issue.id]: {
          ...pendingDispatch(issue.identifier),
          taskId: task.id,
          taskUrl: task.url,
        },
      }),
      [task]
    );

    const summary = await runCodexFixDispatcher(CONFIG, harness.deps);

    expect(summary.published).toBe(1);
    expect(harness.publisher.publish).toHaveBeenCalledWith(issue, task);
    expect(harness.getState()?.issues[issue.id]).toEqual(
      expect.objectContaining({
        outcome: 'pr_opened',
        prUrl: 'https://github.com/AgasiArgent/kvota-onestack/pull/999',
      })
    );
    expect(harness.linear.createComment).toHaveBeenCalledWith(
      issue.id,
      expect.stringContaining(PR_MARKER)
    );
    expect(harness.linear.updateIssueState).toHaveBeenCalledWith(
      issue.id,
      'review-state'
    );
  });

  it('keeps pr_opened state when the Linear completion update needs a retry', async () => {
    const issue = approved('KVO-109');
    const task = cloudTask('KVO-109');
    const harness = makeHarness(
      [issue],
      stateWith([issue.id], {
        [issue.id]: {
          ...pendingDispatch(issue.identifier),
          taskId: task.id,
          taskUrl: task.url,
        },
      }),
      [task]
    );
    harness.linear.createComment.mockRejectedValueOnce(
      new Error('temporary Linear outage')
    );

    await expect(runCodexFixDispatcher(CONFIG, harness.deps)).rejects.toThrow(
      'temporary Linear outage'
    );

    expect(harness.getState()?.issues[issue.id]).toEqual(
      expect.objectContaining({
        outcome: 'pr_opened',
        prUrl: 'https://github.com/AgasiArgent/kvota-onestack/pull/999',
      })
    );
  });
});
