import { describe, expect, it, vi } from 'vitest';

import type { MutationInput } from '@colanode/client/mutations';
import { createColanodeApi, type ColanodeApiDeps } from './colanode-api';

const buildStub = () => {
  const mediator = {
    executeQuery: vi.fn().mockResolvedValue(['query-result']),
    executeQueryAndSubscribe: vi.fn().mockResolvedValue(['live-result']),
    unsubscribeQuery: vi.fn(),
    executeMutation: vi
      .fn()
      .mockResolvedValue({ success: true, output: { id: 'srv1' } }),
  };

  const deps: ColanodeApiDeps = {
    mediator: mediator as unknown as ColanodeApiDeps['mediator'],
    windowId: 'win-1',
    openUrl: vi.fn().mockResolvedValue(undefined),
    push: {
      enable: vi.fn().mockResolvedValue(true),
      disable: vi.fn().mockResolvedValue(undefined),
      getState: vi.fn().mockResolvedValue('disabled'),
      isSupported: () => false,
    },
  };

  return { deps, mediator };
};

describe('createColanodeApi', () => {
  it('delegates executeQuery to the mediator and returns its result', async () => {
    const { deps, mediator } = buildStub();
    const api = createColanodeApi(deps);

    const result = await api.executeQuery({ type: 'server.list' });

    expect(mediator.executeQuery).toHaveBeenCalledWith({ type: 'server.list' });
    expect(result).toEqual(['query-result']);
  });

  it('injects its windowId between key and input when subscribing', async () => {
    const { deps, mediator } = buildStub();
    const api = createColanodeApi(deps);

    await api.executeQueryAndSubscribe('key-1', { type: 'server.list' });

    expect(mediator.executeQueryAndSubscribe).toHaveBeenCalledWith('key-1', 'win-1', {
      type: 'server.list',
    });
  });

  it('unsubscribes with the same windowId', async () => {
    const { deps, mediator } = buildStub();
    const api = createColanodeApi(deps);

    await api.unsubscribeQuery('key-1');

    expect(mediator.unsubscribeQuery).toHaveBeenCalledWith('key-1', 'win-1');
  });

  it('passes the mutation result envelope through unchanged', async () => {
    const { deps } = buildStub();
    const api = createColanodeApi(deps);

    const input = {
      type: 'server.create',
      url: 'https://example.com/config',
    } as MutationInput;
    const result = await api.executeMutation(input);

    expect(result).toEqual({ success: true, output: { id: 'srv1' } });
  });

  it('resolves init with success — native boot gates readiness itself', async () => {
    const { deps } = buildStub();
    const api = createColanodeApi(deps);

    await expect(api.init()).resolves.toBe('success');
  });

  it('rejects saveTempFile as not implemented on mobile', async () => {
    const { deps } = buildStub();
    const api = createColanodeApi(deps);

    await expect(api.saveTempFile({} as File)).rejects.toThrow(/not implemented/i);
  });
});
