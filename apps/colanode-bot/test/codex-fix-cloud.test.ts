import { describe, expect, it, vi } from 'vitest';

import { CloudTasks } from '../src/codex-fix/cloud';
import {
  CommandResult,
  CommandRunner,
  CloudTask,
} from '../src/codex-fix/types';

const task = (id: string): CloudTask => ({
  id,
  url: `https://chatgpt.com/codex/tasks/${id}`,
  title: `Linear Mention: KVO-109: Task ${id}`,
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
});

const wireTask = (value: CloudTask) => ({
  id: value.id,
  url: value.url,
  title: value.title,
  status: value.status,
  updated_at: value.updatedAt,
  environment_id: value.environmentId,
  environment_label: value.environmentLabel,
  summary: {
    files_changed: value.summary.filesChanged,
    lines_added: value.summary.linesAdded,
    lines_removed: value.summary.linesRemoved,
  },
  is_review: value.isReview,
  attempt_total: value.attemptTotal,
});

const success = (payload: unknown): CommandResult => ({
  stdout: JSON.stringify(payload),
  stderr: '',
  exitCode: 0,
});

describe('CloudTasks', () => {
  it('paginates codex cloud list and returns validated tasks', async () => {
    const runner: CommandRunner = vi
      .fn()
      .mockResolvedValueOnce(
        success({
          tasks: [wireTask(task('task-1'))],
          cursor: 'opaque+cursor==',
        })
      )
      .mockResolvedValueOnce(
        success({ tasks: [wireTask(task('task-2'))], cursor: null })
      );
    const cloud = new CloudTasks(runner, {
      baseEnv: { PATH: '/bin', SAFE_VALUE: 'kept' },
    });

    await expect(cloud.list()).resolves.toEqual([
      task('task-1'),
      task('task-2'),
    ]);
    expect(runner).toHaveBeenNthCalledWith(
      1,
      'codex',
      ['cloud', 'list', '--json', '--limit', '20'],
      expect.objectContaining({
        env: expect.objectContaining({ SAFE_VALUE: 'kept' }),
      })
    );
    expect(runner).toHaveBeenNthCalledWith(
      2,
      'codex',
      [
        'cloud',
        'list',
        '--json',
        '--limit',
        '20',
        '--cursor',
        'opaque+cursor==',
      ],
      expect.any(Object)
    );
  });

  it('rejects a task missing required summary data', async () => {
    const invalid = wireTask(task('task-1')) as Record<string, unknown>;
    invalid.summary = { files_changed: 2, lines_added: 8 };
    const runner: CommandRunner = vi
      .fn()
      .mockResolvedValue(success({ tasks: [invalid], cursor: null }));

    await expect(new CloudTasks(runner).list()).rejects.toThrow(
      'Invalid Codex Cloud task'
    );
  });

  it('passes an opaque cursor as one command argument', async () => {
    const runner: CommandRunner = vi
      .fn()
      .mockResolvedValueOnce(
        success({ tasks: [], cursor: 'cursor with spaces & symbols' })
      )
      .mockResolvedValueOnce(success({ tasks: [], cursor: null }));

    await new CloudTasks(runner).list();

    const args = vi.mocked(runner).mock.calls[1]![1];
    expect(args.at(-1)).toBe('cursor with spaces & symbols');
    expect(args).toHaveLength(7);
  });

  it('removes Linear and triage secrets from the command environment', async () => {
    const runner: CommandRunner = vi
      .fn()
      .mockResolvedValue(success({ tasks: [], cursor: null }));
    const cloud = new CloudTasks(runner, {
      baseEnv: {
        PATH: '/bin',
        HOME: '/home/test',
        LINEAR_API_KEY: 'linear-secret',
        TRIAGE_OPS_TOKEN: 'triage-secret',
        SAFE_VALUE: 'kept',
      },
    });

    await cloud.list();

    const env = vi.mocked(runner).mock.calls[0]![2].env!;
    expect(env).toEqual({
      PATH: '/bin',
      HOME: '/home/test',
      SAFE_VALUE: 'kept',
    });
  });
});
