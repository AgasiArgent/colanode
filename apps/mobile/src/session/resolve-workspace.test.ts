import { describe, expect, it } from 'vitest';

import type { Metadata, Workspace } from '@colanode/client/types';
import { resolveDefaultUserId } from './resolve-workspace';

const ws = (userId: string): Workspace =>
  ({ userId, workspaceId: `w-${userId}`, accountId: 'acc-1' }) as Workspace;
const meta = (value: string): Metadata =>
  ({ namespace: 'app', key: 'workspace', value }) as Metadata;

describe('resolveDefaultUserId', () => {
  it('returns the metadata-remembered userId when it still exists', () => {
    expect(
      resolveDefaultUserId([ws('u1'), ws('u2')], [meta(JSON.stringify('u2'))])
    ).toBe('u2');
  });

  it('falls back to the first workspace when the remembered id is stale', () => {
    expect(
      resolveDefaultUserId([ws('u1')], [meta(JSON.stringify('gone'))])
    ).toBe('u1');
  });

  it('survives malformed metadata json', () => {
    expect(resolveDefaultUserId([ws('u1')], [meta('{oops')])).toBe('u1');
  });

  it('returns undefined with no workspaces', () => {
    expect(resolveDefaultUserId([], [])).toBeUndefined();
  });
});
