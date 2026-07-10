import { useMemo } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import { Server } from '@colanode/client/types';
import { type Palette } from '@colanode/mobile/theme/palette';
import { useTheme } from '@colanode/mobile/theme/theme-context';
import { radius, spacing } from '@colanode/mobile/theme/tokens';
import { fonts, labelTracking, typeScale } from '@colanode/mobile/theme/typography';
import { useLiveQuery } from '@colanode/ui/hooks/use-live-query';

const createStyles = (palette: Palette) =>
  StyleSheet.create({
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.background,
    },
    list: { flex: 1, backgroundColor: palette.background },
    header: {
      fontFamily: fonts.monoSemiBold,
      fontSize: typeScale.caption.fontSize,
      letterSpacing: labelTracking,
      textTransform: 'uppercase',
      color: palette.textMuted,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.lg,
      paddingBottom: spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: palette.border,
      gap: spacing.md,
    },
    rowText: { flex: 1, gap: spacing.xs },
    name: {
      ...typeScale.body,
      fontFamily: fonts.bodyBold,
      color: palette.textPrimary,
    },
    domain: {
      ...typeScale.caption,
      fontFamily: fonts.mono,
      color: palette.textMuted,
    },
    statusDot: { width: 9, height: 9, borderRadius: radius.full },
    empty: {
      ...typeScale.body,
      color: palette.textMuted,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    error: { ...typeScale.body, color: palette.danger },
  });

const ServerRow = ({ server }: { server: Server }) => {
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
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
              ? palette.accent
              : palette.textFaint,
          },
        ]}
      />
    </View>
  );
};

export const SettingsScreen = () => {
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const serverList = useLiveQuery({ type: 'server.list' });

  if (serverList.isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator testID="settings-loading-indicator" color={palette.accent} />
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
