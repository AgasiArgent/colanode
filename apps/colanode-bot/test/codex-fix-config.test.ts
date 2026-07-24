import { describe, expect, it } from 'vitest';

import { loadCodexFixConfig } from '../src/codex-fix/config';

const ENABLED_ENV: NodeJS.ProcessEnv = {
  CODEX_FIX_LOOP_ENABLED: 'true',
  LINEAR_API_KEY: 'linear-key',
  CODEX_FIX_LINEAR_TEAM_ID: 'team-kvo',
  CODEX_FIX_APPROVED_STATE: 'Approved for fix',
  CODEX_FIX_REVIEW_STATE: 'In Review',
  CODEX_FIX_TARGET_REPO: '/workspace/kvota-onestack',
  CODEX_FIX_GITHUB_REPO: 'AgasiArgent/kvota-onestack',
  CODEX_FIX_BASE_BRANCH: 'main',
  CODEX_FIX_CLOUD_ENVIRONMENT: 'kvota-onestack',
  CODEX_FIX_STATE_FILE: '/state/codex-fix/state.json',
};

describe('loadCodexFixConfig', () => {
  it('defaults to disabled without requiring credentials', () => {
    expect(loadCodexFixConfig({})).toEqual({ enabled: false });
    expect(loadCodexFixConfig({ CODEX_FIX_LOOP_ENABLED: 'false' })).toEqual({
      enabled: false,
    });
  });

  it('loads an enabled, absolute, project-scoped configuration', () => {
    expect(loadCodexFixConfig(ENABLED_ENV)).toEqual({
      enabled: true,
      linearApiKey: 'linear-key',
      teamId: 'team-kvo',
      approvedStateName: 'Approved for fix',
      reviewStateName: 'In Review',
      targetRepoPath: '/workspace/kvota-onestack',
      githubRepo: 'AgasiArgent/kvota-onestack',
      baseBranch: 'main',
      cloudEnvironment: 'kvota-onestack',
      stateFile: '/state/codex-fix/state.json',
      worktreeRoot: '/state/codex-fix/worktrees',
    });
  });

  it('fails closed when an enabled run is missing required configuration', () => {
    expect(() =>
      loadCodexFixConfig({
        CODEX_FIX_LOOP_ENABLED: 'true',
        LINEAR_API_KEY: 'linear-key',
      })
    ).toThrow('Missing required env var CODEX_FIX_LINEAR_TEAM_ID');
  });

  it('rejects relative repository and state paths', () => {
    expect(() =>
      loadCodexFixConfig({
        ...ENABLED_ENV,
        CODEX_FIX_TARGET_REPO: '../kvota-onestack',
      })
    ).toThrow('CODEX_FIX_TARGET_REPO must be an absolute path');
    expect(() =>
      loadCodexFixConfig({
        ...ENABLED_ENV,
        CODEX_FIX_STATE_FILE: 'state.json',
      })
    ).toThrow('CODEX_FIX_STATE_FILE must be an absolute path');
  });

  it('rejects unknown kill-switch values', () => {
    expect(() =>
      loadCodexFixConfig({ CODEX_FIX_LOOP_ENABLED: 'sometimes' })
    ).toThrow('Invalid CODEX_FIX_LOOP_ENABLED');
  });
});
