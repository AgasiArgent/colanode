import { pathToFileURL } from 'node:url';

import { CloudTasks } from './cloud';
import { runCommand } from './command';
import { loadCodexFixConfig } from './config';
import { runCodexFixDispatcher } from './dispatcher';
import { DraftPrPublisher } from './publisher';
import { loadDispatcherState, saveDispatcherState } from './state';
import { LinearApi } from '../linear/client';

export const runCodexFixOnce = async (
  env: NodeJS.ProcessEnv = process.env
): Promise<Record<string, unknown>> => {
  const config = loadCodexFixConfig(env);
  if (!config.enabled) {
    return { skipped: true, reason: 'disabled' };
  }

  const linear = new LinearApi(config.linearApiKey);
  const cloud = new CloudTasks(runCommand, { baseEnv: env });
  const publisher = new DraftPrPublisher(
    {
      targetRepoPath: config.targetRepoPath,
      githubRepo: config.githubRepo,
      baseBranch: config.baseBranch,
      worktreeRoot: config.worktreeRoot,
      baseEnv: env,
    },
    runCommand
  );

  return runCodexFixDispatcher(config, {
    linear,
    cloud,
    publisher,
    state: {
      load: () => loadDispatcherState(config.stateFile),
      save: (state) => saveDispatcherState(config.stateFile, state),
    },
    now: () => new Date(),
  });
};

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  runCodexFixOnce()
    .then((summary) => {
      process.stdout.write(
        `${JSON.stringify({ event: 'codex-fix-run', ...summary })}\n`
      );
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`[codex-fix] ${message}\n`);
      process.exitCode = 1;
    });
}
