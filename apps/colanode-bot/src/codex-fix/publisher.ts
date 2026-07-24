import { mkdir, mkdtemp, rmdir } from 'node:fs/promises';
import { join } from 'node:path';

import { sanitizedChildEnv } from './command-env';
import { CloudTask, CommandResult, CommandRunner } from './types';
import { LinearFixIssue } from '../linear/client';

export type DraftPrPublisherConfig = {
  targetRepoPath: string;
  githubRepo: string;
  baseBranch: string;
  worktreeRoot: string;
  baseEnv?: NodeJS.ProcessEnv;
  codexCommand?: string;
  gitCommand?: string;
  ghCommand?: string;
};

type ExistingPr = {
  url: string;
  number: number;
  state: string;
  isDraft: boolean;
};

export class RetryableDraftPrError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RetryableDraftPrError';
  }
}

const commandError = (label: string, result: CommandResult): Error => {
  const detail = (result.stderr.trim() || result.stdout.trim()).slice(0, 500);
  return new Error(
    `${label} failed with exit ${result.exitCode}${detail ? `: ${detail}` : ''}`
  );
};

const validateGithubUrl = (value: string, field: string): string => {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'github.com') {
      throw new Error('unexpected origin');
    }
  } catch {
    throw new Error(`Invalid GitHub URL from ${field}`);
  }
  return value;
};

const parseExistingPr = (stdout: string): ExistingPr | null => {
  let value: unknown;
  try {
    value = JSON.parse(stdout);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid gh pr list JSON: ${message}`);
  }
  if (!Array.isArray(value) || value.length > 1) {
    throw new Error('Invalid gh pr list response');
  }
  if (value.length === 0) {
    return null;
  }
  const pr = value[0];
  if (
    typeof pr !== 'object' ||
    pr === null ||
    typeof pr.url !== 'string' ||
    !Number.isInteger(pr.number) ||
    typeof pr.state !== 'string' ||
    typeof pr.isDraft !== 'boolean'
  ) {
    throw new Error('Invalid gh pr list response');
  }
  return {
    url: validateGithubUrl(pr.url, 'gh pr list'),
    number: pr.number,
    state: pr.state,
    isDraft: pr.isDraft,
  };
};

export const branchNameFor = (
  issue: LinearFixIssue,
  task: CloudTask
): string => {
  const identifier = issue.identifier.toLowerCase();
  const suffix = task.id
    .replace(/[^a-z0-9]/gi, '')
    .slice(-12)
    .toLowerCase();
  if (!/^[a-z][a-z0-9]*-\d+$/.test(identifier) || suffix.length === 0) {
    throw new Error(
      'Cannot derive a safe branch name for the Codex Cloud task'
    );
  }
  return `codex/${identifier}-${suffix}`;
};

const prBody = (
  issue: LinearFixIssue,
  task: CloudTask
): string => `## Linear issue

- [${issue.identifier}](${issue.url})

## Codex Cloud

- [Completed task](${task.url})
- Files changed: ${task.summary.filesChanged}
- Lines: +${task.summary.linesAdded}/-${task.summary.linesRemoved}

This draft PR was materialized automatically from the exact Codex Cloud diff.
Review the issue context, implementation, and checks before merging.`;

export class DraftPrPublisher {
  private readonly env: NodeJS.ProcessEnv;
  private readonly codexCommand: string;
  private readonly gitCommand: string;
  private readonly ghCommand: string;

  constructor(
    private readonly config: DraftPrPublisherConfig,
    private readonly runner: CommandRunner
  ) {
    this.env = sanitizedChildEnv(config.baseEnv ?? process.env);
    this.codexCommand = config.codexCommand ?? 'codex';
    this.gitCommand = config.gitCommand ?? 'git';
    this.ghCommand = config.ghCommand ?? 'gh';
  }

  private async runRequired(
    command: string,
    args: string[],
    label: string,
    cwd?: string
  ): Promise<CommandResult> {
    const result = await this.runner(command, args, { cwd, env: this.env });
    if (result.exitCode !== 0) {
      throw commandError(label, result);
    }
    return result;
  }

  private async findExistingPr(branch: string): Promise<ExistingPr | null> {
    const result = await this.runRequired(
      this.ghCommand,
      [
        'pr',
        'list',
        '--repo',
        this.config.githubRepo,
        '--state',
        'all',
        '--head',
        branch,
        '--limit',
        '1',
        '--json',
        'url,number,state,isDraft',
      ],
      'gh pr list'
    );
    return parseExistingPr(result.stdout);
  }

  private async remoteBranchExists(branch: string): Promise<boolean> {
    const result = await this.runner(
      this.gitCommand,
      [
        '-C',
        this.config.targetRepoPath,
        'ls-remote',
        '--exit-code',
        '--heads',
        'origin',
        `refs/heads/${branch}`,
      ],
      { env: this.env }
    );
    if (result.exitCode === 0) {
      return true;
    }
    if (result.exitCode === 2) {
      return false;
    }
    throw commandError('git ls-remote', result);
  }

  private async createPr(
    issue: LinearFixIssue,
    task: CloudTask,
    branch: string
  ): Promise<string> {
    const args = [
      'pr',
      'create',
      '--repo',
      this.config.githubRepo,
      '--head',
      branch,
      '--base',
      this.config.baseBranch,
      '--draft',
      '--title',
      `${issue.identifier}: ${issue.title}`.slice(0, 240),
      '--body',
      prBody(issue, task),
    ];
    const result = await this.runner(this.ghCommand, args, { env: this.env });
    if (result.exitCode !== 0) {
      const racedPr = await this.findExistingPr(branch);
      if (racedPr) {
        return racedPr.url;
      }
      throw new RetryableDraftPrError(
        commandError('gh pr create', result).message
      );
    }
    return validateGithubUrl(result.stdout.trim(), 'gh pr create');
  }

  private async publishBranch(
    issue: LinearFixIssue,
    task: CloudTask,
    branch: string
  ): Promise<void> {
    await mkdir(this.config.worktreeRoot, { recursive: true, mode: 0o700 });
    await this.runRequired(
      this.gitCommand,
      [
        '-C',
        this.config.targetRepoPath,
        'fetch',
        'origin',
        this.config.baseBranch,
      ],
      'git fetch'
    );

    const allocationPath = await mkdtemp(
      join(this.config.worktreeRoot, 'run-')
    );
    const worktreePath = join(allocationPath, 'repo');
    let worktreeAdded = false;
    let primaryError: unknown;
    let hasPrimaryError = false;
    let cleanupError: Error | null = null;

    try {
      await this.runRequired(
        this.gitCommand,
        [
          '-C',
          this.config.targetRepoPath,
          'worktree',
          'add',
          '--detach',
          worktreePath,
          `origin/${this.config.baseBranch}`,
        ],
        'git worktree add'
      );
      worktreeAdded = true;

      await this.runRequired(
        this.codexCommand,
        ['cloud', 'apply', task.id],
        'codex cloud apply',
        worktreePath
      );
      const status = await this.runRequired(
        this.gitCommand,
        [
          '-C',
          worktreePath,
          'status',
          '--porcelain=v1',
          '--untracked-files=all',
        ],
        'git status'
      );
      if (status.stdout.trim().length === 0) {
        throw new Error(
          `${issue.identifier} Codex Cloud task produced no local changes`
        );
      }

      await this.runRequired(
        this.gitCommand,
        ['-C', worktreePath, 'add', '-A'],
        'git add'
      );
      await this.runRequired(
        this.gitCommand,
        ['-C', worktreePath, 'diff', '--cached', '--check'],
        'git diff --check'
      );
      await this.runRequired(
        this.gitCommand,
        ['-C', worktreePath, 'commit', '-m', `fix: ${issue.identifier}`],
        'git commit'
      );
      await this.runRequired(
        this.gitCommand,
        ['-C', worktreePath, 'push', 'origin', `HEAD:refs/heads/${branch}`],
        'git push'
      );
    } catch (error) {
      primaryError = error;
      hasPrimaryError = true;
    } finally {
      if (worktreeAdded) {
        try {
          const cleanup = await this.runner(
            this.gitCommand,
            [
              '-C',
              this.config.targetRepoPath,
              'worktree',
              'remove',
              '--force',
              worktreePath,
            ],
            { env: this.env }
          );
          if (cleanup.exitCode !== 0) {
            cleanupError = commandError('git worktree remove', cleanup);
          }
        } catch (error) {
          cleanupError =
            error instanceof Error ? error : new Error(String(error));
        }
      }
      try {
        await rmdir(allocationPath);
      } catch (error) {
        if (
          error instanceof Error &&
          'code' in error &&
          error.code !== 'ENOENT'
        ) {
          cleanupError = error;
        }
      }
    }

    if (hasPrimaryError) {
      throw primaryError;
    }
    if (cleanupError) {
      throw cleanupError;
    }
  }

  async publish(
    issue: LinearFixIssue,
    task: CloudTask
  ): Promise<{ url: string; branch: string }> {
    const branch = branchNameFor(issue, task);
    const existingPr = await this.findExistingPr(branch);
    if (existingPr) {
      return { url: existingPr.url, branch };
    }

    if (!(await this.remoteBranchExists(branch))) {
      await this.publishBranch(issue, task, branch);
    }

    return {
      url: await this.createPr(issue, task, branch),
      branch,
    };
  }
}
