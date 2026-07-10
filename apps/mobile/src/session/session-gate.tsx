import { useMemo } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import { AuthNavigator } from '@colanode/mobile/navigation/auth-navigator';
import { RootNavigator } from '@colanode/mobile/navigation/root-navigator';
import { NoWorkspaceScreen } from '@colanode/mobile/screens/auth/no-workspace-screen';
import {
  CurrentWorkspaceContext,
  type CurrentWorkspace,
} from '@colanode/mobile/session/current-workspace-context';
import { resolveDefaultUserId } from '@colanode/mobile/session/resolve-workspace';
import { useTheme } from '@colanode/mobile/theme/theme-context';
import { useLiveQuery } from '@colanode/ui/hooks/use-live-query';
import { useMutation } from '@colanode/ui/hooks/use-mutation';

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

export const SessionGate = () => {
  const { palette } = useTheme();
  const accountList = useLiveQuery({ type: 'account.list' });
  const workspaceList = useLiveQuery({ type: 'workspace.list' });
  const metadataList = useLiveQuery({ type: 'metadata.list' });
  const { mutate } = useMutation();

  const accounts = accountList.data ?? [];
  const workspaces = workspaceList.data ?? [];
  const metadata = metadataList.data ?? [];

  const session = useMemo((): CurrentWorkspace | null => {
    const userId = resolveDefaultUserId(workspaces, metadata);
    const workspace = workspaces.find((item) => item.userId === userId);
    if (!workspace) {
      return null;
    }
    const account = accounts.find((item) => item.id === workspace.accountId);
    if (!account) {
      return null;
    }

    const selectWorkspace = (nextUserId: string) => {
      const saveError = (error: { message: string }) =>
        Alert.alert('Could not switch workspace', error.message);
      mutate({
        input: {
          type: 'metadata.update',
          namespace: 'app',
          key: 'workspace',
          value: JSON.stringify(nextUserId),
        },
        onError: saveError,
      });
      const next = workspaces.find((item) => item.userId === nextUserId);
      if (next) {
        mutate({
          input: {
            type: 'metadata.update',
            namespace: next.accountId,
            key: 'workspace',
            value: JSON.stringify(nextUserId),
          },
          onError: saveError,
        });
      }
    };

    return { workspace, account, selectWorkspace };
  }, [accounts, workspaces, metadata, mutate]);

  if (
    accountList.isPending ||
    workspaceList.isPending ||
    metadataList.isPending
  ) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.accent} />
      </View>
    );
  }

  if (accounts.length === 0) {
    return <AuthNavigator />;
  }

  if (!session) {
    return <NoWorkspaceScreen account={accounts[0]!} />;
  }

  return (
    <CurrentWorkspaceContext.Provider value={session}>
      <RootNavigator />
    </CurrentWorkspaceContext.Provider>
  );
};
