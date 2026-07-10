import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import { Server } from '@colanode/client/types';
import { tokens } from '@colanode/mobile/theme/tokens';
import { useLiveQuery } from '@colanode/ui/hooks/use-live-query';

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.background,
  },
  list: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  header: {
    fontSize: tokens.fontSize.sm,
    fontWeight: '600',
    color: tokens.colors.textMuted,
    textTransform: 'uppercase',
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.lg,
    paddingBottom: tokens.spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.colors.border,
    gap: tokens.spacing.md,
  },
  rowText: {
    flex: 1,
    gap: tokens.spacing.xs,
  },
  name: {
    fontSize: tokens.fontSize.md,
    fontWeight: '600',
    color: tokens.colors.textPrimary,
  },
  domain: {
    fontSize: tokens.fontSize.sm,
    color: tokens.colors.textSecondary,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  empty: {
    fontSize: tokens.fontSize.sm,
    color: tokens.colors.textMuted,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
  },
  error: {
    fontSize: tokens.fontSize.sm,
    color: tokens.colors.danger,
  },
});

const ServerRow = ({ server }: { server: Server }) => (
  <View style={styles.row} testID={`server-${server.domain}`}>
    <View style={styles.rowText}>
      <Text style={styles.name}>{server.name}</Text>
      <Text style={styles.domain}>
        {server.domain} · v{server.version}
      </Text>
    </View>
    <View
      style={[
        styles.statusDot,
        {
          backgroundColor: server.state?.isAvailable
            ? tokens.colors.success
            : tokens.colors.textMuted,
        },
      ]}
    />
  </View>
);

export const SettingsScreen = () => {
  const serverList = useLiveQuery({ type: 'server.list' });

  if (serverList.isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator testID="settings-loading-indicator" />
      </View>
    );
  }

  if (serverList.isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Failed to load servers.</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      testID="settings-server-list"
      data={serverList.data}
      keyExtractor={(server) => server.domain}
      renderItem={({ item }) => <ServerRow server={item} />}
      ListHeaderComponent={<Text style={styles.header}>Servers</Text>}
      ListEmptyComponent={<Text style={styles.empty}>No servers added yet</Text>}
    />
  );
};
