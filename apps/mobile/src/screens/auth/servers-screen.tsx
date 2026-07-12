import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Server } from '@colanode/client/types';
import { Button } from '@colanode/mobile/components/button';
import { type AuthStackParamList } from '@colanode/mobile/navigation/auth-navigator';
import { type Palette } from '@colanode/mobile/theme/palette';
import { useTheme } from '@colanode/mobile/theme/theme-context';
import { radius, spacing } from '@colanode/mobile/theme/tokens';
import {
  fonts,
  labelTracking,
  typeScale,
} from '@colanode/mobile/theme/typography';
import { useLiveQuery } from '@colanode/ui/hooks/use-live-query';

const createStyles = (palette: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: palette.background },
    listContent: { padding: spacing.md, gap: spacing.sm },
    label: {
      fontFamily: fonts.monoSemiBold,
      fontSize: typeScale.caption.fontSize,
      letterSpacing: labelTracking,
      textTransform: 'uppercase',
      color: palette.textMuted,
      marginBottom: spacing.sm,
    },
    card: {
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: radius.lg,
      backgroundColor: palette.surface,
      padding: spacing.md,
      gap: spacing.xs,
    },
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
    footer: { padding: spacing.md, gap: spacing.sm },
    empty: { ...typeScale.body, color: palette.textMuted },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  });

type Props = NativeStackScreenProps<AuthStackParamList, 'Servers'>;

export const ServersScreen = ({ navigation }: Props) => {
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const serverList = useLiveQuery({ type: 'server.list' });

  if (serverList.isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.accent} />
      </View>
    );
  }

  const servers = serverList.data ?? [];

  return (
    <View style={styles.container}>
      <FlatList
        data={servers}
        testID="auth-server-list"
        keyExtractor={(server: Server) => server.domain}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <Text style={styles.label}>Connect to your server</Text>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            No servers yet. Add the one your team runs.
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            testID={`auth-server-${item.domain}`}
            accessibilityRole="button"
            style={styles.card}
            onPress={() =>
              navigation.navigate('Credentials', {
                serverDomain: item.domain,
                serverName: item.name,
              })
            }
          >
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.domain}>
              {item.domain} · v{item.version}
            </Text>
          </Pressable>
        )}
      />
      <View style={styles.footer}>
        <Button
          label="Add server"
          variant="secondary"
          testID="auth-server-add"
          onPress={() => navigation.navigate('ServerAdd')}
        />
      </View>
    </View>
  );
};
