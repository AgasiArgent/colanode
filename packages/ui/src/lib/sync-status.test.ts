import { describe, expect, it } from 'vitest';

import { getSyncStatusView } from '@colanode/ui/lib/sync-status';

describe('getSyncStatusView', () => {
  it('shows saved locally with pulse while mutations are pending', () => {
    expect(getSyncStatusView(3, true)).toEqual({
      label: 'saved locally',
      tone: 'accent',
      pulse: true,
    });
  });

  it('shows synced when the queue is empty and the server is available', () => {
    expect(getSyncStatusView(0, true)).toEqual({
      label: 'synced',
      tone: 'accent',
      pulse: false,
    });
  });

  it('shows offline in spore tone when the server is unavailable', () => {
    expect(getSyncStatusView(0, false)).toEqual({
      label: 'offline',
      tone: 'spore',
      pulse: false,
    });
    expect(getSyncStatusView(5, false)).toEqual({
      label: 'offline',
      tone: 'spore',
      pulse: false,
    });
  });
});
