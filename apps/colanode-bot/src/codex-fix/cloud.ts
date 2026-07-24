import { sanitizedChildEnv } from './command-env';
import { CloudTask, CommandRunner } from './types';

type CloudTasksOptions = {
  command?: string;
  baseEnv?: NodeJS.ProcessEnv;
  maxPages?: number;
};

const DEFAULT_PAGE_LIMIT = 20;
const DEFAULT_MAX_PAGES = 5;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const requiredString = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid Codex Cloud task field: ${field}`);
  }
  return value;
};

const nonNegativeInteger = (value: unknown, field: string): number => {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new Error(`Invalid Codex Cloud task field: ${field}`);
  }
  return value as number;
};

const parseTask = (value: unknown): CloudTask => {
  if (!isRecord(value) || !isRecord(value.summary)) {
    throw new Error('Invalid Codex Cloud task');
  }

  const updatedAt = requiredString(value.updated_at, 'updated_at');
  if (Number.isNaN(Date.parse(updatedAt))) {
    throw new Error('Invalid Codex Cloud task field: updated_at');
  }
  if (
    value.environment_id !== null &&
    typeof value.environment_id !== 'string'
  ) {
    throw new Error('Invalid Codex Cloud task field: environment_id');
  }
  if (typeof value.is_review !== 'boolean') {
    throw new Error('Invalid Codex Cloud task field: is_review');
  }

  return {
    id: requiredString(value.id, 'id'),
    url: requiredString(value.url, 'url'),
    title: requiredString(value.title, 'title'),
    status: requiredString(value.status, 'status'),
    updatedAt,
    environmentId: value.environment_id,
    environmentLabel: requiredString(
      value.environment_label,
      'environment_label'
    ),
    summary: {
      filesChanged: nonNegativeInteger(
        value.summary.files_changed,
        'summary.files_changed'
      ),
      linesAdded: nonNegativeInteger(
        value.summary.lines_added,
        'summary.lines_added'
      ),
      linesRemoved: nonNegativeInteger(
        value.summary.lines_removed,
        'summary.lines_removed'
      ),
    },
    isReview: value.is_review,
    attemptTotal: nonNegativeInteger(value.attempt_total, 'attempt_total'),
  };
};

const parsePage = (
  stdout: string
): { tasks: CloudTask[]; cursor: string | null } => {
  let value: unknown;
  try {
    value = JSON.parse(stdout);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid Codex Cloud list JSON: ${message}`);
  }
  if (!isRecord(value) || !Array.isArray(value.tasks)) {
    throw new Error('Invalid Codex Cloud list response');
  }
  if (
    value.cursor !== undefined &&
    value.cursor !== null &&
    typeof value.cursor !== 'string'
  ) {
    throw new Error('Invalid Codex Cloud list cursor');
  }

  return {
    tasks: value.tasks.map(parseTask),
    cursor: value.cursor ?? null,
  };
};

export class CloudTasks {
  private readonly command: string;
  private readonly env: NodeJS.ProcessEnv;
  private readonly maxPages: number;

  constructor(
    private readonly runner: CommandRunner,
    options: CloudTasksOptions = {}
  ) {
    this.command = options.command ?? 'codex';
    this.env = sanitizedChildEnv(options.baseEnv ?? process.env);
    this.maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  }

  async list(): Promise<CloudTask[]> {
    const tasks: CloudTask[] = [];
    const seenIds = new Set<string>();
    let cursor: string | null = null;

    for (let pageNumber = 1; pageNumber <= this.maxPages; pageNumber += 1) {
      const args = [
        'cloud',
        'list',
        '--json',
        '--limit',
        String(DEFAULT_PAGE_LIMIT),
      ];
      if (cursor !== null) {
        args.push('--cursor', cursor);
      }

      const result = await this.runner(this.command, args, { env: this.env });
      if (result.exitCode !== 0) {
        throw new Error(
          `codex cloud list failed with exit ${result.exitCode}: ${result.stderr.slice(0, 500)}`
        );
      }

      const page = parsePage(result.stdout);
      for (const task of page.tasks) {
        if (seenIds.has(task.id)) {
          throw new Error(
            `Duplicate Codex Cloud task across pages: ${task.id}`
          );
        }
        seenIds.add(task.id);
        tasks.push(task);
      }
      if (page.cursor === null) {
        return tasks;
      }
      cursor = page.cursor;
    }

    throw new Error(
      `Codex Cloud list exceeded the ${this.maxPages}-page safety limit`
    );
  }
}
