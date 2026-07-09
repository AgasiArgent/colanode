import { describe, expect, it } from 'vitest';

import { AccountSocket } from '@colanode/client/services/accounts/account-socket';

const makeAccount = (post: () => unknown) =>
  ({
    id: 'ac-test',
    server: { isAvailable: true, socketBaseUrl: 'ws://127.0.0.1:1' },
    client: { post },
  }) as never;

describe('AccountSocket.init', () => {
  it('resolves instead of rejecting when the socket token request fails', async () => {
    const socket = new AccountSocket(
      makeAccount(() => ({
        json: () => Promise.reject(new Error('connect ECONNREFUSED')),
      }))
    );

    // Callers fire init() without awaiting it — a rejection here becomes an
    // unhandled rejection that kills Node hosts (the headless MCP engine).
    await expect(socket.init()).resolves.toBeUndefined();
  });

  it('backs off after a failed token request', async () => {
    const socket = new AccountSocket(
      makeAccount(() => ({
        json: () => Promise.reject(new Error('connect ECONNREFUSED')),
      }))
    );

    await socket.init();

    // BackoffCalculator blocks immediate retries after an error.
    let attempts = 0;
    const counting = new AccountSocket(
      makeAccount(() => {
        attempts++;
        return { json: () => Promise.reject(new Error('ECONNREFUSED')) };
      })
    );
    await counting.init();
    await counting.init();
    expect(attempts).toBe(1);
  });
});
