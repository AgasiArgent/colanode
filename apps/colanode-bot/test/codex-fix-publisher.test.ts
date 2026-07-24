import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { DraftPrPublisher, branchNameFor } from '../src/codex-fix/publisher';
import {
  CloudTask,
  CommandResult,
  CommandRunner,
} from '../src/codex-fix/types';
import { LinearFixIssue } from '../src/linear/client';

const ISSUE: LinearFixIssue = {
  id: 'issue-109',
  identifier: 'KVO-109',
  title: 'Customs columns are separated',
  url: 'https://linear.app/acme/issue/KVO-109',
  stateName: 'Approved for fix',
  comments: [],
};

const TASK: CloudTask = {
  id: 'task_e_6a63512c801c832db414cab53737a7f1',
  url: 'https://chatgpt.com/codex/tasks/task_e_6a63512c801c832db414cab53737a7f1',
  title: 'Linear Mention: KVO-109: Customs columns are separated',
  status: 'ready',
  updatedAt: '2026-07-24T10:10:00.000Z',
  environmentId: null,
  environmentLabel: 'kvota-onestack',
  summary: { filesChanged: 2, linesAdded: 24, linesRemoved: 12 },
  isReview: false,
  attemptTotal: 1,
};

const ok = (stdout = ''): CommandResult => ({
  stdout,
  stderr: '',
  exitCode: 0,
});

const exit = (exitCode: number, stderr: string): CommandResult => ({
  stdout: '',
  stderr,
  exitCode,
});

const tempDirectories: string[] = [];

const makePublisher = async (runner: CommandRunner) => {
  const root = await mkdtemp(join(tmpdir(), 'codex-fix-publisher-test-'));
  tempDirectories.push(root);
  return new DraftPrPublisher(
    {
      targetRepoPath: '/workspace/kvota-onestack',
      githubRepo: 'AgasiArgent/kvota-onestack',
      baseBranch: 'main',
      worktreeRoot: root,
      baseEnv: {
        PATH: '/bin',
        HOME: '/home/test',
        LINEAR_API_KEY: 'linear-secret',
        TRIAGE_OPS_TOKEN: 'triage-secret',
        SAFE_VALUE: 'kept',
      },
    },
    runner
  );
};

afterEach(async () => {
  await Promise.all(
    tempDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true }))
  );
});

describe('DraftPrPublisher', () => {
  it('reuses an existing PR without applying or pushing the diff', async () => {
    const runner: CommandRunner = vi.fn().mockResolvedValue(
      ok(
        JSON.stringify([
          {
            url: 'https://github.com/AgasiArgent/kvota-onestack/pull/600',
            number: 600,
            state: 'OPEN',
            isDraft: true,
          },
        ])
      )
    );
    const publisher = await makePublisher(runner);

    await expect(publisher.publish(ISSUE, TASK)).resolves.toEqual({
      url: 'https://github.com/AgasiArgent/kvota-onestack/pull/600',
      branch: branchNameFor(ISSUE, TASK),
    });
    expect(runner).toHaveBeenCalledTimes(1);
    expect(runner).toHaveBeenCalledWith(
      'gh',
      [
        'pr',
        'list',
        '--repo',
        'AgasiArgent/kvota-onestack',
        '--state',
        'all',
        '--head',
        branchNameFor(ISSUE, TASK),
        '--limit',
        '1',
        '--json',
        'url,number,state,isDraft',
      ],
      expect.any(Object)
    );
  });

  it('opens a draft PR from an existing remote branch without reapplying', async () => {
    const runner: CommandRunner = vi
      .fn()
      .mockResolvedValueOnce(ok('[]'))
      .mockResolvedValueOnce(ok('remote branch'))
      .mockResolvedValueOnce(
        ok('https://github.com/AgasiArgent/kvota-onestack/pull/601\n')
      );
    const publisher = await makePublisher(runner);

    const result = await publisher.publish(ISSUE, TASK);

    expect(result.url).toBe(
      'https://github.com/AgasiArgent/kvota-onestack/pull/601'
    );
    expect(runner).toHaveBeenCalledTimes(3);
    expect(vi.mocked(runner).mock.calls[2]![0]).toBe('gh');
    expect(vi.mocked(runner).mock.calls[2]![1]).toEqual(
      expect.arrayContaining([
        '--draft',
        '--head',
        branchNameFor(ISSUE, TASK),
        '--base',
        'main',
      ])
    );
    expect(
      vi
        .mocked(runner)
        .mock.calls.some(([command, args]) =>
          [command, ...args].join(' ').includes('cloud apply')
        )
    ).toBe(false);
  });

  it('applies a fresh Cloud diff in a temporary worktree and pushes a draft PR', async () => {
    const runner: CommandRunner = vi
      .fn()
      .mockResolvedValueOnce(ok('[]'))
      .mockResolvedValueOnce(exit(2, 'no matching refs'))
      .mockResolvedValueOnce(ok())
      .mockResolvedValueOnce(ok())
      .mockResolvedValueOnce(ok())
      .mockResolvedValueOnce(ok(' M frontend/src/example.ts\n'))
      .mockResolvedValueOnce(ok())
      .mockResolvedValueOnce(ok())
      .mockResolvedValueOnce(ok())
      .mockResolvedValueOnce(ok())
      .mockResolvedValueOnce(ok())
      .mockResolvedValueOnce(
        ok('https://github.com/AgasiArgent/kvota-onestack/pull/602\n')
      );
    const publisher = await makePublisher(runner);

    const result = await publisher.publish(ISSUE, TASK);

    expect(result).toEqual({
      url: 'https://github.com/AgasiArgent/kvota-onestack/pull/602',
      branch: branchNameFor(ISSUE, TASK),
    });
    const calls = vi.mocked(runner).mock.calls;
    expect(calls.map(([command]) => command)).toEqual([
      'gh',
      'git',
      'git',
      'git',
      'codex',
      'git',
      'git',
      'git',
      'git',
      'git',
      'git',
      'gh',
    ]);
    expect(calls[4]![1]).toEqual(['cloud', 'apply', TASK.id]);
    expect(calls[7]![1]).toEqual(
      expect.arrayContaining(['diff', '--cached', '--check'])
    );
    expect(calls[8]![1]).toEqual(
      expect.arrayContaining(['commit', '-m', 'fix: KVO-109'])
    );
    expect(calls[9]![1]).toEqual(
      expect.arrayContaining([
        'push',
        'origin',
        `HEAD:refs/heads/${branchNameFor(ISSUE, TASK)}`,
      ])
    );
    expect(calls[11]![1]).toEqual(
      expect.arrayContaining([
        '--draft',
        '--head',
        branchNameFor(ISSUE, TASK),
        '--base',
        'main',
      ])
    );
    const prBody = calls[11]![1][calls[11]![1].indexOf('--body') + 1];
    expect(prBody).toContain(ISSUE.url);
    expect(prBody).toContain(TASK.url);
    for (const [, , options] of calls) {
      expect(options.env).toEqual(
        expect.objectContaining({ SAFE_VALUE: 'kept' })
      );
      expect(options.env).not.toHaveProperty('LINEAR_API_KEY');
      expect(options.env).not.toHaveProperty('TRIAGE_OPS_TOKEN');
    }
  });

  it('does not push when the Cloud diff cannot be applied', async () => {
    const runner: CommandRunner = vi
      .fn()
      .mockResolvedValueOnce(ok('[]'))
      .mockResolvedValueOnce(exit(2, 'no matching refs'))
      .mockResolvedValueOnce(ok())
      .mockResolvedValueOnce(ok())
      .mockResolvedValueOnce(exit(1, 'patch failed'))
      .mockResolvedValueOnce(ok());
    const publisher = await makePublisher(runner);

    await expect(publisher.publish(ISSUE, TASK)).rejects.toThrow(
      'codex cloud apply failed'
    );
    expect(
      vi.mocked(runner).mock.calls.some(([, args]) => args.includes('push'))
    ).toBe(false);
  });

  it('does not push an empty applied diff', async () => {
    const runner: CommandRunner = vi
      .fn()
      .mockResolvedValueOnce(ok('[]'))
      .mockResolvedValueOnce(exit(2, 'no matching refs'))
      .mockResolvedValueOnce(ok())
      .mockResolvedValueOnce(ok())
      .mockResolvedValueOnce(ok())
      .mockResolvedValueOnce(ok(''))
      .mockResolvedValueOnce(ok());
    const publisher = await makePublisher(runner);

    await expect(publisher.publish(ISSUE, TASK)).rejects.toThrow(
      'produced no local changes'
    );
    expect(
      vi.mocked(runner).mock.calls.some(([, args]) => args.includes('push'))
    ).toBe(false);
  });

  it('does not push a diff that fails git diff --check', async () => {
    const runner: CommandRunner = vi
      .fn()
      .mockResolvedValueOnce(ok('[]'))
      .mockResolvedValueOnce(exit(2, 'no matching refs'))
      .mockResolvedValueOnce(ok())
      .mockResolvedValueOnce(ok())
      .mockResolvedValueOnce(ok())
      .mockResolvedValueOnce(ok(' M frontend/src/example.ts\n'))
      .mockResolvedValueOnce(ok())
      .mockResolvedValueOnce(exit(2, 'whitespace error'))
      .mockResolvedValueOnce(ok());
    const publisher = await makePublisher(runner);

    await expect(publisher.publish(ISSUE, TASK)).rejects.toThrow(
      'git diff --check failed'
    );
    expect(
      vi.mocked(runner).mock.calls.some(([, args]) => args.includes('push'))
    ).toBe(false);
  });
});
