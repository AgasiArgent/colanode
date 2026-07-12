import { Ionicons } from '@expo/vector-icons';
import { eq, useLiveQuery } from '@tanstack/react-db';
import { useNavigation } from '@react-navigation/native';
import { type BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { Alert, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';

import type { LocalNode, LocalSpaceNode } from '@colanode/client/types';
import { NodeAvatar } from '@colanode/mobile/components/node-avatar';
import { type RootTabParamList } from '@colanode/mobile/navigation/root-navigator';
import { type SpacesStackParamList } from '@colanode/mobile/navigation/spaces-navigator';
import { useCurrentWorkspace } from '@colanode/mobile/session/current-workspace-context';
import { useRadar } from '@colanode/mobile/session/radar-context';
import { type Palette } from '@colanode/mobile/theme/palette';
import { useTheme } from '@colanode/mobile/theme/theme-context';
import { radius, spacing } from '@colanode/mobile/theme/tokens';
import { fonts, labelTracking, typeScale } from '@colanode/mobile/theme/typography';
import { groupSpaceChildrenByType, sortSpaceChildren } from '@colanode/ui/lib/spaces';

const TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  channel: 'chatbubble-outline',
  page: 'document-text-outline',
  database: 'grid-outline',
  folder: 'folder-outline',
  record: 'bookmark-outline',
};

const nodeTypeIcon = (type: string): keyof typeof Ionicons.glyphMap =>
  TYPE_ICONS[type] ?? 'ellipse-outline';

const nodeName = (node: LocalNode): string =>
  ((node as { name?: string | null }).name ?? '').trim() || 'Untitled';

const nodeAvatar = (node: LocalNode): string | null | undefined =>
  (node as { avatar?: string | null }).avatar;

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
      backgroundColor: palette.background,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
    },
    name: {
      ...typeScale.body,
      color: palette.textPrimary,
      flex: 1,
    },
    dot: {
      width: 9,
      height: 9,
      borderRadius: radius.full,
      backgroundColor: palette.spore,
    },
    empty: {
      ...typeScale.body,
      color: palette.textMuted,
      textAlign: 'center',
      padding: spacing.xl,
    },
  });

type Props = NativeStackScreenProps<SpacesStackParamList, 'Space'>;

export const SpaceScreen = ({ route, navigation }: Props) => {
  const { nodeId } = route.params;
  const { collections } = useCurrentWorkspace();
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const radar = useRadar();
  const tabNavigation =
    useNavigation<BottomTabNavigationProp<RootTabParamList>>();

  const spaceQuery = useLiveQuery(
    (q) =>
      q
        .from({ nodes: collections.nodes })
        .where(({ nodes }) => eq(nodes.id, nodeId))
        .findOne(),
    [nodeId]
  );
  const childrenQuery = useLiveQuery(
    (q) =>
      q
        .from({ nodes: collections.nodes })
        .where(({ nodes }) => eq(nodes.parentId, nodeId)),
    [nodeId]
  );

  const space = spaceQuery.data as LocalSpaceNode | undefined;
  const sections = useMemo(() => {
    if (!space) return [];
    const sorted = sortSpaceChildren(space, (childrenQuery.data ?? []) as LocalNode[]);
    return groupSpaceChildrenByType(sorted).map((group) => ({
      title: group.label,
      data: group.items,
    }));
  }, [space, childrenQuery.data]);

  const open = (node: LocalNode) => {
    if (node.type === 'channel') {
      tabNavigation.navigate('Chats', {
        screen: 'Conversation',
        params: { nodeId: node.id, title: nodeName(node) },
      });
      return;
    }
    if (node.type === 'page') {
      navigation.navigate('Page', {
        nodeId: node.id,
        title: nodeName(node),
      });
      return;
    }
    Alert.alert(
      'Not available on mobile yet',
      'Open this on desktop or web to see it.'
    );
  };

  return (
    <SectionList
      style={styles.list}
      testID="space-children"
      sections={sections}
      keyExtractor={(item) => item.id}
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) => (
        <Text style={styles.header}>{section.title}</Text>
      )}
      renderItem={({ item }) => {
        const unread =
          item.type === 'channel' ? radar.getNodeState(item.id) : null;
        const avatar = nodeAvatar(item);
        return (
          <Pressable
            style={styles.row}
            accessibilityRole="button"
            testID={`space-child-${item.id}`}
            onPress={() => open(item)}
          >
            {avatar ? (
              <NodeAvatar
                id={item.id}
                avatar={avatar}
                name={nodeName(item)}
                size={28}
              />
            ) : (
              <Ionicons
                name={nodeTypeIcon(item.type)}
                size={20}
                color={palette.textMuted}
              />
            )}
            <Text style={styles.name} numberOfLines={1}>
              {nodeName(item)}
            </Text>
            {unread?.hasUnread ? <View style={styles.dot} /> : null}
          </Pressable>
        );
      }}
      ListEmptyComponent={
        <Text style={styles.empty}>Nothing here yet.</Text>
      }
    />
  );
};
