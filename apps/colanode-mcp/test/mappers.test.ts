import { describe, expect, it } from 'vitest';

import { buildChannelAttributes } from '@colanode/mcp/tools/create-channel';
import { buildPageAttributes } from '@colanode/mcp/tools/create-page';
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

describe('buildPageAttributes', () => {
  it('builds a page with parentId and optional avatar', () => {
    expect(buildPageAttributes('Notes', 'sp-1')).toEqual({
      type: 'page',
      name: 'Notes',
      parentId: 'sp-1',
      avatar: null,
    });
    expect(buildPageAttributes('Notes', 'sp-1', 'av-9').avatar).toBe('av-9');
  });
});

describe('buildChannelAttributes', () => {
  it('builds a channel with parentId', () => {
    expect(buildChannelAttributes('general', 'sp-1')).toEqual({
      type: 'channel',
      name: 'general',
      parentId: 'sp-1',
      avatar: null,
    });
  });
});
