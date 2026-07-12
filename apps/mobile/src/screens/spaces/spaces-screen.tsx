import { eq, useLiveQuery } from '@tanstack/react-db';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import type { LocalSpaceNode } from '@colanode/client/types';
import { NodeAvatar } from '@colanode/mobile/components/node-avatar';
import { type SpacesStackParamList } from '@colanode/mobile/navigation/spaces-navigator';
import { useCurrentWorkspace } from '@colanode/mobile/session/current-workspace-context';
import { type Palette } from '@colanode/mobile/theme/palette';
import { useTheme } from '@colanode/mobile/theme/theme-context';
import { spacing } from '@colanode/mobile/theme/tokens';
import { fonts, typeScale } from '@colanode/mobile/theme/typography';

const createStyles = (palette: Palette) =>
  StyleSheet.create({
    list: { flex: 1, backgroundColor: palette.background },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: palette.border,
    },
    text: { flex: 1, gap: 2 },
    name: { ...typeScale.body, fontFamily: fonts.bodyBold, color: palette.textPrimary },
    description: { ...typeScale.caption, color: palette.textMuted },
    empty: {
      ...typeScale.body,
      color: palette.textMuted,
      textAlign: 'center',
      padding: spacing.xl,
    },
  });

type Props = NativeStackScreenProps<SpacesStackParamList, 'SpacesHome'>;

export const SpacesScreen = ({ navigation }: Props) => {
  const { collections } = useCurrentWorkspace();
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);

  const spacesQuery = useLiveQuery(
    (q) =>
      q
        .from({ nodes: collections.nodes })
        .where(({ nodes }) => eq(nodes.type, 'space'))
        .orderBy(({ nodes }) => nodes.id, 'asc'),
    []
  );
  const spaces = (spacesQuery.data ?? []).map((node) => node as LocalSpaceNode);

  return (
    <FlatList
      style={styles.list}
      testID="spaces-list"
      data={spaces}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <Pressable
          style={styles.row}
          accessibilityRole="button"
          testID={`space-${item.id}`}
          onPress={() =>
            navigation.navigate('Space', { nodeId: item.id, title: item.name })
          }
        >
          <NodeAvatar id={item.id} avatar={item.avatar} name={item.name} size={40} />
          <View style={styles.text}>
            <Text style={styles.name} numberOfLines={1}>
              {item.name}
            </Text>
            {item.description ? (
              <Text style={styles.description} numberOfLines={1}>
                {item.description}
              </Text>
            ) : null}
          </View>
        </Pressable>
      )}
      ListEmptyComponent={
        <Text style={styles.empty}>No spaces yet. Create one on desktop.</Text>
      }
    />
  );
};
