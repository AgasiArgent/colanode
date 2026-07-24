import { homedir } from 'node:os';
import { dirname, isAbsolute, join } from 'node:path';

import { DispatcherConfig } from './dispatcher';

export type DisabledCodexFixConfig = {
  enabled: false;
};

export type EnabledCodexFixConfig = DispatcherConfig & {
  enabled: true;
  linearApiKey: string;
  targetRepoPath: string;
  baseBranch: string;
  stateFile: string;
  worktreeRoot: string;
};

export type CodexFixConfig = DisabledCodexFixConfig | EnabledCodexFixConfig;

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const FALSE_VALUES = new Set(['', '0', 'false', 'no', 'off']);

const isEnabled = (env: NodeJS.ProcessEnv): boolean => {
  const value = (env.CODEX_FIX_LOOP_ENABLED ?? '').trim().toLowerCase();
  if (TRUE_VALUES.has(value)) {
    return true;
  }
  if (FALSE_VALUES.has(value)) {
    return false;
  }
  throw new Error(`Invalid CODEX_FIX_LOOP_ENABLED: ${value}`);
};

const required = (env: NodeJS.ProcessEnv, name: string): string => {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env var ${name}`);
  }
  return value;
};

const absolutePath = (
  env: NodeJS.ProcessEnv,
  name: string,
  defaultValue?: string
): string => {
  const value = env[name]?.trim() || defaultValue;
  if (!value) {
    throw new Error(`Missing required env var ${name}`);
  }
  if (!isAbsolute(value)) {
    throw new Error(`${name} must be an absolute path`);
  }
  return value;
};

export const loadCodexFixConfig = (
  env: NodeJS.ProcessEnv = process.env
): CodexFixConfig => {
  if (!isEnabled(env)) {
    return { enabled: false };
  }

  const linearApiKey = required(env, 'LINEAR_API_KEY');
  const teamId = required(env, 'CODEX_FIX_LINEAR_TEAM_ID');
  const approvedStateName = required(env, 'CODEX_FIX_APPROVED_STATE');
  const reviewStateName = required(env, 'CODEX_FIX_REVIEW_STATE');
  const targetRepoPath = absolutePath(env, 'CODEX_FIX_TARGET_REPO');
  const githubRepo = required(env, 'CODEX_FIX_GITHUB_REPO');
  if (!/^[^/\s]+\/[^/\s]+$/.test(githubRepo)) {
    throw new Error('CODEX_FIX_GITHUB_REPO must be owner/repository');
  }
  const baseBranch = required(env, 'CODEX_FIX_BASE_BRANCH');
  if (/\s/.test(baseBranch)) {
    throw new Error('CODEX_FIX_BASE_BRANCH must not contain whitespace');
  }
  const stateFile = absolutePath(
    env,
    'CODEX_FIX_STATE_FILE',
    join(homedir(), '.local', 'state', 'triage-codex-fix', 'state.json')
  );

  return {
    enabled: true,
    linearApiKey,
    teamId,
    approvedStateName,
    reviewStateName,
    targetRepoPath,
    githubRepo,
    baseBranch,
    cloudEnvironment: required(env, 'CODEX_FIX_CLOUD_ENVIRONMENT'),
    stateFile,
    worktreeRoot: join(dirname(stateFile), 'worktrees'),
  };
};
