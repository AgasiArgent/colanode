import type { Metadata, Workspace } from '@colanode/client/types';

// Mirrors packages/ui/src/routes/utils.tsx getDefaultWorkspaceUserId, but as a
// pure function over query results (the web reads TanStack DB collections).
// The ('app','workspace') metadata row stores the last-used userId as JSON.
export const resolveDefaultUserId = (
  workspaces: Workspace[],
  metadata: Metadata[]
): string | undefined => {
  const userIds = workspaces.map((workspace) => workspace.userId);
  const row = metadata.find(
    (item) => item.namespace === 'app' && item.key === 'workspace'
  );

  if (row) {
    try {
      const lastUsed = JSON.parse(row.value) as string;
      if (userIds.includes(lastUsed)) {
        return lastUsed;
      }
    } catch (error) {
      console.warn('[Mobile] malformed app.workspace metadata', row.value, error);
    }
  }

  return userIds[0];
};
