import { describe, expect, it } from 'vitest';

import { runCommand } from '../src/codex-fix/command';

describe('runCommand', () => {
  it('captures stdout, stderr, and a non-zero exit without invoking a shell', async () => {
    const result = await runCommand(
      process.execPath,
      [
        '-e',
        'process.stdout.write("out"); process.stderr.write("err"); process.exitCode = 3;',
      ],
      { env: process.env }
    );

    expect(result).toEqual({
      stdout: 'out',
      stderr: 'err',
      exitCode: 3,
    });
  });
});
