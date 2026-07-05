import { afterEach, describe, expect, it, vi } from 'vitest';

import { collectDebugContext, installErrorInterceptors } from './debugContext';

describe('features/bug-report/debugContext', () => {
  afterEach(() => vi.restoreAllMocks());

  it('captures console.error messages into the context', () => {
    installErrorInterceptors();
    console.error('boom', { a: 1 });
    const ctx = collectDebugContext();
    expect(ctx.url).toBe(window.location.href);
    expect(ctx.consoleErrors.some((e) => e.message.includes('boom'))).toBe(true);
    expect(ctx.consoleErrors.every((e) => typeof e.time === 'string')).toBe(true);
  });
});
