import { describe, expect, it } from 'vitest';

import { buildNodeListInput } from '@colanode/mcp/tools/list-nodes';

describe('buildNodeListInput', () => {
  it('filters by parentId when given', () => {
    const input = buildNodeListInput('us-1', { parentId: 'sp-1' });
    expect(input).toEqual({
      type: 'node.list',
      userId: 'us-1',
      filters: [{ field: 'parentId', operator: '=', value: 'sp-1' }],
      sorts: [],
      limit: 100,
    });
  });

  it('filters by rootId and respects an explicit limit', () => {
    const input = buildNodeListInput('us-1', { rootId: 'sp-9', limit: 10 });
    expect(input.filters).toEqual([
      { field: 'rootId', operator: '=', value: 'sp-9' },
    ]);
    expect(input.limit).toBe(10);
  });

  it('returns no filters when neither parentId nor rootId given', () => {
    expect(buildNodeListInput('us-1', {}).filters).toEqual([]);
  });
});
