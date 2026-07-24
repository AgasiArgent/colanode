import { execFile } from 'node:child_process';

import { CommandRunner } from './types';

const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;

export const runCommand: CommandRunner = (command, args, options) =>
  new Promise((resolve) => {
    execFile(
      command,
      args,
      {
        cwd: options.cwd,
        env: options.env,
        encoding: 'utf8',
        maxBuffer: MAX_OUTPUT_BYTES,
        shell: false,
      },
      (error, stdout, stderr) => {
        const exitCode =
          error && typeof error.code === 'number'
            ? error.code
            : error
              ? 127
              : 0;
        const launchError =
          error && typeof error.code !== 'number' ? error.message : '';
        resolve({
          stdout,
          stderr: `${stderr}${launchError}`,
          exitCode,
        });
      }
    );
  });
