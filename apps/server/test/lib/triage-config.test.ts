import { describe, expect, it } from 'vitest';

import { triageConfigSchema } from '@colanode/server/lib/config/triage';

describe('triageConfigSchema', () => {
  it('defaults to no service token', () => {
    const parsed = triageConfigSchema.parse(undefined);
    expect(parsed.serviceToken).toBeUndefined();
  });

  it('accepts a literal service token', () => {
    const parsed = triageConfigSchema.parse({ serviceToken: 'secret-1' });
    expect(parsed.serviceToken).toBe('secret-1');
  });
});
