import { describe, expect, it } from 'vitest';

import { recordAttributesSchema } from '@colanode/core/registry/nodes/record';

describe('recordAttributesSchema.sourceMessageId', () => {
  it('accepts sourceMessageId', () => {
    const r = recordAttributesSchema.safeParse({
      type: 'record',
      parentId: 'db1',
      databaseId: 'db1',
      name: 'Record',
      fields: {},
      sourceMessageId: 'msg1',
    });

    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.sourceMessageId).toBe('msg1');
    }
  });

  it('accepts absence of sourceMessageId', () => {
    expect(
      recordAttributesSchema.safeParse({
        type: 'record',
        parentId: 'db1',
        databaseId: 'db1',
        name: 'Record',
        fields: {},
      }).success
    ).toBe(true);
  });
});
