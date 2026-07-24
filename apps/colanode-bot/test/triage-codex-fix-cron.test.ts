import { spawnSync } from 'node:child_process';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT = fileURLToPath(
  new URL('../../../scripts/triage-codex-fix-cron.sh', import.meta.url)
);
const tempDirectories: string[] = [];

const setup = async (
  switchValue: string,
  fakeFlock = false
): Promise<{
  directory: string;
  envFile: string;
  marker: string;
  env: NodeJS.ProcessEnv;
}> => {
  const directory = await mkdtemp(join(tmpdir(), 'codex-fix-cron-test-'));
  tempDirectories.push(directory);
  const bin = join(directory, 'bin');
  const marker = join(directory, 'npm-invocation');
  const envFile = join(directory, 'env');
  await import('node:fs/promises').then((fs) =>
    fs.mkdir(bin, { recursive: true })
  );
  await writeFile(
    join(bin, 'npm'),
    '#!/usr/bin/env bash\nprintf "%s\\n" "$*" > "$FAKE_NPM_MARKER"\n',
    'utf8'
  );
  await chmod(join(bin, 'npm'), 0o755);
  if (fakeFlock) {
    await writeFile(
      join(bin, 'flock'),
      '#!/usr/bin/env bash\nexit 1\n',
      'utf8'
    );
    await chmod(join(bin, 'flock'), 0o755);
  }
  await writeFile(
    envFile,
    [
      `CODEX_FIX_LOOP_ENABLED=${switchValue}`,
      `TRIAGE_REPO=${directory}/repo`,
      `CODEX_FIX_LOG=${directory}/codex-fix.log`,
      `CODEX_FIX_LOCK=${directory}/codex-fix.lock`,
      '',
    ].join('\n'),
    'utf8'
  );

  return {
    directory,
    envFile,
    marker,
    env: {
      ...process.env,
      HOME: directory,
      PATH: `${bin}:/usr/bin:/bin`,
      TRIAGE_ENV_FILE: envFile,
      FAKE_NPM_MARKER: marker,
    },
  };
};

afterEach(async () => {
  await Promise.all(
    tempDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true }))
  );
});

describe('triage-codex-fix-cron.sh', () => {
  it('does nothing when the independent kill switch is off', async () => {
    const fixture = await setup('false');

    const result = spawnSync('bash', [SCRIPT], {
      env: fixture.env,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    await expect(readFile(fixture.marker, 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('invokes one dispatcher run when enabled', async () => {
    const fixture = await setup('true');

    const result = spawnSync('bash', [SCRIPT], {
      env: fixture.env,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(await readFile(fixture.marker, 'utf8')).toContain(
      'run -s triage:codex-fix'
    );
  });

  it('skips cleanly when another dispatcher holds the lock', async () => {
    const fixture = await setup('true', true);

    const result = spawnSync('bash', [SCRIPT], {
      env: fixture.env,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    await expect(readFile(fixture.marker, 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });
});
