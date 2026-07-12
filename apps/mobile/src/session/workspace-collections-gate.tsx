import { eq, useLiveQuery } from '@tanstack/react-db';
import { type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useTheme } from '@colanode/mobile/theme/theme-context';
import { collections } from '@colanode/ui/collections';

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

// collections.workspace(userId) throws until the workspaces collection has
// synced the row for this user (same guard the web Workspace component
// implements via its own live query). Render children only once it is safe.
export const WorkspaceCollectionsGate = ({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) => {
  const { palette } = useTheme();
  const workspaceRow = useLiveQuery(
    (q) =>
      q
        .from({ workspaces: collections.workspaces })
        .where(({ workspaces }) => eq(workspaces.userId, userId))
        .findOne(),
    [userId]
  );

  if (!workspaceRow.data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.accent} />
      </View>
    );
  }

  return <>{children}</>;
};
