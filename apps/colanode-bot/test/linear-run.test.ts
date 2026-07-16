import { describe, expect, it, vi } from 'vitest';

import { ProjectorDeps, runProjector } from '../src/linear/run';
import { QueueCluster } from '../src/linear/types';

const LINEAR_CONFIG = {
  enabled: true,
  teamId: 'team-1',
  teamKey: 'KVO',
  cutoverAt: '2026-01-01T00:00:00Z',
  labels: { bug: 'label-bug' },
};

const ISSUE = {
  id: 'iss-1',
  identifier: 'KVO-11',
  url: 'https://linear.app/x/issue/KVO-11',
  stateName: 'Triage',
  stateType: 'triage',
  description: '',
};

const makeCluster = (overrides: Partial<QueueCluster> = {}): QueueCluster => ({
  id: 'c-1',
  rootHypothesis: 'total not recalculated after discount',
  itemCount: 1,
  status: 'open',
  decision: null,
  items: [{ id: 'i1', summary: 'stale total', triage: 'bug', sourceRef: {} }],
  reports: [
    {
      id: 'r1',
      title: 'wrong total',
      did: 'applied discount',
      expected: 'total updates',
      got: 'total unchanged',
      pageUrl: 'https://app.kvotaflow.ru/calc',
      reporterName: 'Denis',
      debugContext: { shortId: 'FB-1' },
      artifacts: [],
      recordingUrl: null,
    },
  ],
  relations: [],
  linear: null,
  ...overrides,
});

const makeDeps = (clusters: QueueCluster[]): ProjectorDeps => ({
  ops: {
    listProjects: vi
      .fn()
      .mockResolvedValue([{ id: 'lp', name: 'LP', killSwitch: false }]),
    getQueue: vi.fn().mockResolvedValue({
      project: { id: 'lp', linear: LINEAR_CONFIG },
      clusters,
    }),
    recordIssue: vi.fn().mockResolvedValue(undefined),
    reconcile: vi.fn().mockResolvedValue({ applied: 0 }),
    fetchArtifact: vi.fn(),
  },
  linear: {
    issueById: vi.fn().mockResolvedValue(null),
    ensureIssue: vi.fn().mockResolvedValue(ISSUE),
    updateIssueDescription: vi.fn().mockResolvedValue(undefined),
    uploadFile: vi.fn().mockResolvedValue('https://uploads.linear.app/a.png'),
    createRelation: vi.fn().mockResolvedValue(undefined),
    issuesUpdatedSince: vi.fn().mockResolvedValue([]),
  },
  log: vi.fn(),
});

describe('runProjector', () => {
  it('projects a queued cluster with no linear row: ensureIssue + recordIssue', async () => {
    const deps = makeDeps([makeCluster()]);

    await runProjector('post', deps);

    expect(deps.linear.ensureIssue).toHaveBeenCalledTimes(1);
    expect(deps.linear.ensureIssue).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'c-1',
        teamId: 'team-1',
        title: 'total not recalculated after discount',
      })
    );
    expect(deps.ops.recordIssue).toHaveBeenCalledWith(
      'c-1',
      expect.objectContaining({ issueId: 'iss-1', identifier: 'KVO-11' })
    );
  });

  it('records a per-cluster failure and does not throw out of runProjector', async () => {
    const deps = makeDeps([makeCluster()]);
    vi.mocked(deps.linear.ensureIssue).mockRejectedValue(
      new Error('issueCreate exploded')
    );

    await expect(runProjector('post', deps)).resolves.toBeUndefined();

    expect(deps.ops.recordIssue).toHaveBeenCalledWith(
      'c-1',
      expect.objectContaining({
        issueId: '',
        errorCode: 'projection-failed',
        errorMessage: expect.stringContaining('issueCreate exploded'),
      })
    );
  });

  it('phase pre reconciles and never touches issues', async () => {
    const deps = makeDeps([makeCluster()]);

    await runProjector('pre', deps);

    expect(deps.ops.reconcile).toHaveBeenCalledWith(
      'lp',
      expect.objectContaining({ cursorTs: expect.any(String) })
    );
    expect(deps.linear.ensureIssue).not.toHaveBeenCalled();
    expect(deps.linear.updateIssueDescription).not.toHaveBeenCalled();
  });

  it('skips an oversized artifact and notes the omission in the description', async () => {
    const cluster = makeCluster();
    cluster.reports[0]!.artifacts = [
      { id: 'a1', kind: 'screenshot', contentType: 'image/png' },
    ];
    const deps = makeDeps([cluster]);
    vi.mocked(deps.ops.fetchArtifact).mockResolvedValue({
      bytes: new Uint8Array(10 * 1024 * 1024 + 1),
      contentType: 'image/png',
    });

    await runProjector('post', deps);

    expect(deps.linear.uploadFile).not.toHaveBeenCalled();
    const input = vi.mocked(deps.linear.ensureIssue).mock.calls[0]![0];
    expect(input.description).toContain('_screenshot omitted (>10 MB)_');
  });
});
