import { eq, useLiveQuery } from '@tanstack/react-db';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';

import type { LocalChannelNode, LocalChatNode } from '@colanode/client/types';
import { ChatListItem } from '@colanode/mobile/screens/chats/chat-list-item';
import { NodeAvatar } from '@colanode/mobile/components/node-avatar';
import { type ChatsStackParamList } from '@colanode/mobile/navigation/chats-navigator';
import { useCurrentWorkspace } from '@colanode/mobile/session/current-workspace-context';
import { useRadar } from '@colanode/mobile/session/radar-context';
import { type Palette } from '@colanode/mobile/theme/palette';
import { useTheme } from '@colanode/mobile/theme/theme-context';
import { radius, spacing } from '@colanode/mobile/theme/tokens';
import { fonts, labelTracking, typeScale } from '@colanode/mobile/theme/typography';

type ConversationItem = LocalChatNode | LocalChannelNode;

interface ConversationSection {
  key: 'chats' | 'channels';
  title: string;
  data: ConversationItem[];
}

const createStyles = (palette: Palette) =>
  StyleSheet.create({
    list: { flex: 1, backgroundColor: palette.background },
    header: {
      fontFamily: fonts.monoSemiBold,
      fontSize: typeScale.caption.fontSize,
      letterSpacing: labelTracking,
      textTransform: 'uppercase',
      color: palette.textMuted,
      backgroundColor: palette.background,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.lg,
      paddingBottom: spacing.sm,
    },
    channelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
    },
    channelText: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    hash: {
      fontFamily: fonts.monoMedium,
      fontSize: typeScale.body.fontSize,
      color: palette.textFaint,
    },
    channelName: {
      ...typeScale.body,
      fontFamily: fonts.bodyBold,
      color: palette.textPrimary,
      flexShrink: 1,
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
    empty: {
      ...typeScale.body,
      color: palette.textMuted,
      textAlign: 'center',
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.xl,
    },
  });

const ChannelRow = ({
  channel,
  onPress,
}: {
  channel: LocalChannelNode;
  onPress: (nodeId: string, title: string) => void;
}) => {
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const radar = useRadar();
  const unread = radar.getNodeState(channel.id);

  return (
    <Pressable
      style={styles.channelRow}
      testID={`channel-${channel.id}`}
      accessibilityRole="button"
      onPress={() => onPress(channel.id, channel.name)}
    >
      <NodeAvatar
        id={channel.id}
        avatar={channel.avatar}
        name={channel.name}
        size={40}
      />
      <View style={styles.channelText}>
        <Text style={styles.hash}>#</Text>
        <Text style={styles.channelName} numberOfLines={1}>
          {' '}
          {channel.name}
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

type Props = NativeStackScreenProps<ChatsStackParamList, 'ChatsHome'>;

export const ChatsScreen = ({ navigation }: Props) => {
  const { collections } = useCurrentWorkspace();
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);

  const chatsQuery = useLiveQuery(
    (q) =>
      q
        .from({ nodes: collections.nodes })
        .where(({ nodes }) => eq(nodes.type, 'chat'))
        .orderBy(({ nodes }) => nodes.id, 'asc'),
    []
  );

  const channelsQuery = useLiveQuery(
    (q) =>
      q
        .from({ nodes: collections.nodes })
        .where(({ nodes }) => eq(nodes.type, 'channel'))
        .orderBy(({ nodes }) => nodes.id, 'asc'),
    []
  );

  const chats = chatsQuery.data.map((node) => node as LocalChatNode);
  const channels = channelsQuery.data.map((node) => node as LocalChannelNode);

  const openConversation = (nodeId: string, title: string) =>
    navigation.navigate('Conversation', { nodeId, title });

  const sections: ConversationSection[] = [];
  if (chats.length > 0) {
    sections.push({ key: 'chats', title: 'Direct messages', data: chats });
  }
  if (channels.length > 0) {
    sections.push({ key: 'channels', title: 'Channels', data: channels });
  }

  return (
    <SectionList<ConversationItem, ConversationSection>
      style={styles.list}
      testID="chats-list"
      sections={sections}
      keyExtractor={(item) => item.id}
      renderSectionHeader={({ section }) => (
        <Text style={styles.header}>{section.title}</Text>
      )}
      renderItem={({ item }) =>
        item.type === 'chat' ? (
          <ChatListItem chat={item} onPress={openConversation} />
        ) : (
          <ChannelRow channel={item} onPress={openConversation} />
        )
      }
      stickySectionHeadersEnabled={false}
      ListEmptyComponent={
        <Text style={styles.empty}>No conversations yet. Say hello.</Text>
      }
    />
  );
};
