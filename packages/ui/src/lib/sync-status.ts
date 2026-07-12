export interface SyncStatusView {
  label: 'saved locally' | 'synced' | 'offline';
  tone: 'accent' | 'spore';
  pulse: boolean;
}

export const getSyncStatusView = (
  pendingCount: number,
  serverAvailable: boolean
): SyncStatusView => {
  if (!serverAvailable) {
    return { label: 'offline', tone: 'spore', pulse: false };
  }

  if (pendingCount > 0) {
    return { label: 'saved locally', tone: 'accent', pulse: true };
  }

  return { label: 'synced', tone: 'accent', pulse: false };
};
