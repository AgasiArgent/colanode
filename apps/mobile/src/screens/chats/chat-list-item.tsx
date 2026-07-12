import { eq, useLiveQuery } from '@tanstack/react-db';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { LocalChatNode } from '@colanode/client/types';
import { NodeAvatar } from '@colanode/mobile/components/node-avatar';
import { useCurrentWorkspace } from '@colanode/mobile/session/current-workspace-context';
import { useRadar } from '@colanode/mobile/session/radar-context';
import { type Palette } from '@colanode/mobile/theme/palette';
import { useTheme } from '@colanode/mobile/theme/theme-context';
import { radius, spacing } from '@colanode/mobile/theme/tokens';
import { fonts, typeScale } from '@colanode/mobile/theme/typography';

const createStyles = (palette: Palette) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
    },
    text: { flex: 1 },
    name: {
      ...typeScale.body,
      fontFamily: fonts.bodyBold,
      color: palette.textPrimary,
    },
    badge: {
      minWidth: 20,
      height: 20,
      borderRadius: radius.full,
      backgroundColor: palette.spore,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 5,
    },
    badgeText: {
      fontFamily: fonts.monoMedium,
      fontSize: 11,
      color: palette.background,
    },
    dot: {
      width: 9,
      height: 9,
      borderRadius: radius.full,
      backgroundColor: palette.spore,
    },
  });

interface ChatListItemProps {
  chat: LocalChatNode;
  onPress: (nodeId: string, title: string) => void;
}

export const ChatListItem = ({ chat, onPress }: ChatListItemProps) => {
  const { workspace, collections } = useCurrentWorkspace();
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const radar = useRadar();

  const counterpartId =
    Object.keys(chat.collaborators).find((id) => id !== workspace.userId) ?? '';
  const userQuery = useLiveQuery(
    (q) =>
      q
        .from({ users: collections.users })
        .where(({ users }) => eq(users.id, counterpartId))
        .findOne(),
    [counterpartId]
  );

  const user = userQuery.data;
  const name = user?.name ?? 'Unnamed';
  const unread = radar.getNodeState(chat.id);

  return (
    <Pressable
      style={styles.row}
      testID={`chat-${chat.id}`}
      accessibilityRole="button"
      onPress={() => onPress(chat.id, name)}
    >
      <NodeAvatar id={counterpartId} avatar={user?.avatar} name={name} size={40} />
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
      </View>
      {unread.unreadCount > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unread.unreadCount}</Text>
        </View>
      ) : unread.hasUnread ? (
        <View style={styles.dot} />
      ) : null}
    </Pressable>
  );
};
