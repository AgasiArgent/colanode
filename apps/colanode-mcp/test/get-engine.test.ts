import { beforeEach, describe, expect, it, vi } from 'vitest';

const { bootEngineMock } = vi.hoisted(() => ({ bootEngineMock: vi.fn() }));

vi.mock('@colanode/client-node', () => ({ bootEngine: bootEngineMock }));

describe('getEngine', () => {
  beforeEach(() => {
    vi.resetModules();
    bootEngineMock.mockReset();
    process.env.COLANODE_SERVER_URL = 'http://127.0.0.1:3001';
    process.env.COLANODE_EMAIL = 'agent@test.local';
    process.env.COLANODE_PASSWORD = 'secret';
    process.env.COLANODE_DATA_DIR = '/tmp/colanode-mcp-test';
  });

  it('caches a successful boot across calls', async () => {
    const app = { mediator: {} };
    bootEngineMock.mockResolvedValue(app);
    const { getEngine } = await import('@colanode/mcp/bootstrap');

    await expect(getEngine()).resolves.toBe(app);
    await expect(getEngine()).resolves.toBe(app);
    expect(bootEngineMock).toHaveBeenCalledTimes(1);
  });

  it('retries the boot after a failure instead of caching the rejection', async () => {
    const app = { mediator: {} };
    bootEngineMock
      .mockRejectedValueOnce(new Error('server unreachable'))
      .mockResolvedValueOnce(app);
    const { getEngine } = await import('@colanode/mcp/bootstrap');

    await expect(getEngine()).rejects.toThrow('server unreachable');
    await expect(getEngine()).resolves.toBe(app);
    expect(bootEngineMock).toHaveBeenCalledTimes(2);
  });
});
