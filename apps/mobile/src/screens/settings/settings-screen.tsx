import { Ionicons } from '@expo/vector-icons';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Server } from '@colanode/client/types';
import { Button } from '@colanode/mobile/components/button';
import { type SettingsStackParamList } from '@colanode/mobile/navigation/settings-navigator';
import { useCurrentWorkspace } from '@colanode/mobile/session/current-workspace-context';
import { type Palette } from '@colanode/mobile/theme/palette';
import { useTheme } from '@colanode/mobile/theme/theme-context';
import { radius, spacing } from '@colanode/mobile/theme/tokens';
import { fonts, labelTracking, typeScale } from '@colanode/mobile/theme/typography';
import { useLiveQuery } from '@colanode/ui/hooks/use-live-query';
import { useMutation } from '@colanode/ui/hooks/use-mutation';

const createStyles = (palette: Palette) =>
  StyleSheet.create({
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
    avatar: {
      width: 36,
      height: 36,
      borderRadius: radius.full,
      backgroundColor: palette.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitial: {
      fontFamily: fonts.bodyBold,
      color: palette.accentSoftForeground,
    },
    empty: {
      ...typeScale.body,
      color: palette.textMuted,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    error: {
      ...typeScale.body,
      color: palette.danger,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    loading: { paddingVertical: spacing.md },
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

type Props = NativeStackScreenProps<SettingsStackParamList, 'SettingsHome'>;

export const SettingsScreen = ({ navigation }: Props) => {
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const { workspace, account } = useCurrentWorkspace();
  const { isPending, mutate } = useMutation();
  const serverList = useLiveQuery({ type: 'server.list' });

  const servers = serverList.data ?? [];

  return (
    <ScrollView
      style={styles.list}
      testID="settings-server-list"
      contentContainerStyle={{ paddingBottom: spacing.xl }}
    >
      <Text style={styles.header}>Account</Text>
      <View style={styles.row} testID="settings-account">
        <View style={styles.avatar}>
          <Text style={styles.avatarInitial}>
            {account.name.trim().charAt(0).toUpperCase() || '?'}
          </Text>
        </View>
        <View style={styles.rowText}>
          <Text style={styles.name}>{account.name}</Text>
          <Text style={styles.domain}>{account.email}</Text>
        </View>
      </View>

      <Text style={styles.header}>Workspace</Text>
      <Pressable
        style={styles.row}
        testID="settings-workspace"
        accessibilityRole="button"
        onPress={() => navigation.navigate('WorkspacePicker')}
      >
        <View style={styles.rowText}>
          <Text style={styles.name}>{workspace.name}</Text>
          <Text style={styles.domain}>{workspace.role}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={palette.textFaint} />
      </Pressable>

      <Text style={styles.header}>Servers</Text>
      {serverList.isPending ? (
        <ActivityIndicator
          testID="settings-loading-indicator"
          color={palette.accent}
          style={styles.loading}
        />
      ) : serverList.isError ? (
        <Text style={styles.error}>Failed to load servers.</Text>
      ) : servers.length === 0 ? (
        <Text style={styles.empty}>No servers added yet</Text>
      ) : (
        servers.map((server) => <ServerRow key={server.domain} server={server} />)
      )}

      <View style={{ padding: spacing.md }}>
        <Button
          label="Sign out"
          variant="destructive"
          loading={isPending}
          testID="settings-signout"
          onPress={() =>
            Alert.alert(
              'Sign out?',
              'Local data for this account is removed from this device.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Sign out',
                  style: 'destructive',
                  onPress: () =>
                    mutate({
                      input: { type: 'account.logout', accountId: account.id },
                      onError: (error) =>
                        Alert.alert('Sign out failed', error.message),
                    }),
                },
              ]
            )
          }
        />
      </View>
    </ScrollView>
  );
};
