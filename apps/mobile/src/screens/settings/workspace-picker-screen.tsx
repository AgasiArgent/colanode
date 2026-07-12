import { Ionicons } from '@expo/vector-icons';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { type SettingsStackParamList } from '@colanode/mobile/navigation/settings-navigator';
import { useCurrentWorkspace } from '@colanode/mobile/session/current-workspace-context';
import { type Palette } from '@colanode/mobile/theme/palette';
import { useTheme } from '@colanode/mobile/theme/theme-context';
import { spacing } from '@colanode/mobile/theme/tokens';
import { fonts, typeScale } from '@colanode/mobile/theme/typography';
import { useLiveQuery } from '@colanode/ui/hooks/use-live-query';

const createStyles = (palette: Palette) =>
  StyleSheet.create({
    list: { flex: 1, backgroundColor: palette.background },
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
    role: { ...typeScale.caption, color: palette.textMuted },
  });

type Props = NativeStackScreenProps<SettingsStackParamList, 'WorkspacePicker'>;

export const WorkspacePickerScreen = ({ navigation }: Props) => {
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const { workspace, account, selectWorkspace } = useCurrentWorkspace();
  const workspaceList = useLiveQuery({ type: 'workspace.list' });

  const workspaces = (workspaceList.data ?? []).filter(
    (item) => item.accountId === account.id
  );

  return (
    <FlatList
      style={styles.list}
      data={workspaces}
      testID="workspace-picker-list"
      keyExtractor={(item) => item.userId}
      renderItem={({ item }) => (
        <Pressable
          style={styles.row}
          accessibilityRole="button"
          testID={`workspace-${item.workspaceId}`}
          onPress={() => {
            selectWorkspace(item.userId);
            navigation.goBack();
          }}
        >
          <View style={styles.rowText}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.role}>{item.role}</Text>
          </View>
          {item.userId === workspace.userId ? (
            <Ionicons name="checkmark" size={18} color={palette.accent} />
          ) : null}
        </Pressable>
      )}
    />
  );
};
