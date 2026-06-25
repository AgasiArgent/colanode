import { describe, expect, it } from 'vitest';

import { LocalNode } from '@colanode/client/types';

import { collectDescendantIds } from './nodes';

const node = (id: string, parentId: string): LocalNode =>
  ({ id, parentId }) as LocalNode;

describe('collectDescendantIds', () => {
  it('collects direct and transitive descendants, excluding the root', () => {
    const nodes = [
      node('a', 'space'),
      node('b', 'a'),
      node('c', 'b'),
      node('d', 'a'),
    ];
    expect(collectDescendantIds('a', nodes)).toEqual(new Set(['b', 'c', 'd']));
  });

  it('returns empty for a leaf', () => {
    const nodes = [node('a', 'space'), node('b', 'a')];
    expect(collectDescendantIds('b', nodes)).toEqual(new Set());
  });

  it('ignores unrelated subtrees', () => {
    const nodes = [node('a', 'space'), node('x', 'space'), node('y', 'x')];
    expect(collectDescendantIds('a', nodes)).toEqual(new Set());
  });
});
