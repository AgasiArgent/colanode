import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import {
  DispatcherStateV1,
  DispatchOutcome,
  IssueDispatchState,
} from './types';

const OUTCOMES = new Set<DispatchOutcome>([
  'pending',
  'blocked',
  'no_changes',
  'pr_opened',
  'failed',
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const requiredString = (
  value: unknown,
  field: string,
  allowEmpty = false
): string => {
  if (typeof value !== 'string' || (!allowEmpty && value.trim().length === 0)) {
    throw new Error(`Invalid Codex fix state field: ${field}`);
  }
  return value;
};

const optionalString = (value: unknown, field: string): string | undefined => {
  if (value === undefined) {
    return undefined;
  }
  return requiredString(value, field);
};

const isoDate = (value: unknown, field: string): string => {
  const text = requiredString(value, field);
  if (Number.isNaN(Date.parse(text))) {
    throw new Error(`Invalid Codex fix state date: ${field}`);
  }
  return text;
};

const parseIssueState = (value: unknown, key: string): IssueDispatchState => {
  if (!isRecord(value)) {
    throw new Error(`Invalid Codex fix issue state: ${key}`);
  }

  const issueId = requiredString(value.issueId, `${key}.issueId`);
  if (issueId !== key) {
    throw new Error(`Codex fix issue state key mismatch: ${key}`);
  }

  const outcome = requiredString(value.outcome, `${key}.outcome`);
  if (!OUTCOMES.has(outcome as DispatchOutcome)) {
    throw new Error(`Invalid Codex fix state outcome: ${outcome}`);
  }

  return {
    issueId,
    identifier: requiredString(value.identifier, `${key}.identifier`),
    dispatchCommentId: requiredString(
      value.dispatchCommentId,
      `${key}.dispatchCommentId`
    ),
    dispatchedAt: isoDate(value.dispatchedAt, `${key}.dispatchedAt`),
    taskId: optionalString(value.taskId, `${key}.taskId`),
    taskUrl: optionalString(value.taskUrl, `${key}.taskUrl`),
    branch: optionalString(value.branch, `${key}.branch`),
    outcome: outcome as DispatchOutcome,
    prUrl: optionalString(value.prUrl, `${key}.prUrl`),
    lastError: optionalString(value.lastError, `${key}.lastError`),
  };
};

const parseState = (value: unknown): DispatcherStateV1 => {
  if (!isRecord(value)) {
    throw new Error('Invalid Codex fix state root');
  }
  if (value.version !== 1) {
    throw new Error(
      `Unsupported Codex fix state version: ${String(value.version)}`
    );
  }
  if (!Array.isArray(value.approvedIssueIds)) {
    throw new Error('Invalid Codex fix state field: approvedIssueIds');
  }
  const approvedIssueIds = value.approvedIssueIds.map((issueId, index) =>
    requiredString(issueId, `approvedIssueIds[${index}]`)
  );
  if (new Set(approvedIssueIds).size !== approvedIssueIds.length) {
    throw new Error('Invalid Codex fix state: duplicate approved issue ID');
  }
  if (!isRecord(value.issues)) {
    throw new Error('Invalid Codex fix state field: issues');
  }

  const issues = Object.fromEntries(
    Object.entries(value.issues).map(([key, issue]) => [
      key,
      parseIssueState(issue, key),
    ])
  );

  return {
    version: 1,
    initializedAt: isoDate(value.initializedAt, 'initializedAt'),
    approvedIssueIds,
    issues,
  };
};

export const loadDispatcherState = async (
  path: string
): Promise<DispatcherStateV1 | null> => {
  let contents: string;
  try {
    contents = await readFile(path, 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }

  let value: unknown;
  try {
    value = JSON.parse(contents);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid Codex fix state JSON: ${message}`);
  }

  return parseState(value);
};

export const saveDispatcherState = async (
  path: string,
  state: DispatcherStateV1
): Promise<void> => {
  const validated = parseState(state);
  const directory = dirname(path);
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
  await mkdir(directory, { recursive: true, mode: 0o700 });

  try {
    await writeFile(temporaryPath, `${JSON.stringify(validated, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
      flag: 'wx',
    });
    await rename(temporaryPath, path);
  } catch (error) {
    try {
      await unlink(temporaryPath);
    } catch (cleanupError) {
      if (!(
        cleanupError instanceof Error &&
        'code' in cleanupError &&
        cleanupError.code === 'ENOENT'
      )) {
        throw cleanupError;
      }
    }
    throw error;
  }
};
