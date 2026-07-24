import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  loadDispatcherState,
  saveDispatcherState,
} from '../src/codex-fix/state';
import { DispatcherStateV1 } from '../src/codex-fix/types';

const tempDirectories: string[] = [];

const makeTempDirectory = async (): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), 'codex-fix-state-test-'));
  tempDirectories.push(directory);
  return directory;
};

afterEach(async () => {
  await Promise.all(
    tempDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true }))
  );
});

describe('dispatcher state', () => {
  it('returns null only when the state file does not exist', async () => {
    const directory = await makeTempDirectory();

    await expect(
      loadDispatcherState(join(directory, 'missing.json'))
    ).resolves.toBeNull();
  });

  it('round-trips state through a private atomic file', async () => {
    const directory = await makeTempDirectory();
    const path = join(directory, 'nested', 'state.json');
    const state: DispatcherStateV1 = {
      version: 1,
      initializedAt: '2026-07-24T10:00:00.000Z',
      approvedIssueIds: ['issue-4'],
      issues: {
        'issue-4': {
          issueId: 'issue-4',
          identifier: 'KVO-4',
          dispatchCommentId: 'comment-4',
          dispatchedAt: '2026-07-24T10:01:00.000Z',
          taskId: 'task_e_4',
          taskUrl: 'https://chatgpt.com/codex/tasks/task_e_4',
          outcome: 'pending',
        },
      },
    };

    await saveDispatcherState(path, state);

    await expect(loadDispatcherState(path)).resolves.toEqual(state);
    expect((await stat(path)).mode & 0o777).toBe(0o600);
    const directoryEntries = await import('node:fs/promises').then((fs) =>
      fs.readdir(join(directory, 'nested'))
    );
    expect(directoryEntries).toEqual(['state.json']);
  });

  it('rejects malformed JSON instead of silently baselining', async () => {
    const directory = await makeTempDirectory();
    const path = join(directory, 'state.json');
    await writeFile(path, '{not json', 'utf8');

    await expect(loadDispatcherState(path)).rejects.toThrow(
      'Invalid Codex fix state JSON'
    );
  });

  it('rejects unsupported state versions', async () => {
    const directory = await makeTempDirectory();
    const path = join(directory, 'state.json');
    await writeFile(
      path,
      JSON.stringify({
        version: 2,
        initializedAt: '2026-07-24T10:00:00.000Z',
        approvedIssueIds: [],
        issues: {},
      }),
      'utf8'
    );

    await expect(loadDispatcherState(path)).rejects.toThrow(
      'Unsupported Codex fix state version'
    );
    expect(await readFile(path, 'utf8')).toContain('"version":2');
  });
});
