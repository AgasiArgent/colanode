import * as Clipboard from 'expo-clipboard';
import { eq, useLiveInfiniteQuery, useLiveQuery } from '@tanstack/react-db';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo } from 'react';
import {
  ActionSheetIOS,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { JSONContent } from '@tiptap/core';
import { mapBlocksToContents } from '@colanode/client/lib';
import type { LocalMessageNode } from '@colanode/client/types';
import { NodeAvatar } from '@colanode/mobile/components/node-avatar';
import { MessageContent } from '@colanode/mobile/messages/message-content';
import { MessageComposer } from '@colanode/mobile/screens/chats/message-composer';
import { type ChatsStackParamList } from '@colanode/mobile/navigation/chats-navigator';
import { useCurrentWorkspace } from '@colanode/mobile/session/current-workspace-context';
import { useRadar } from '@colanode/mobile/session/radar-context';
import { type Palette } from '@colanode/mobile/theme/palette';
import { useTheme } from '@colanode/mobile/theme/theme-context';
import { radius, spacing } from '@colanode/mobile/theme/tokens';
import { fonts, typeScale } from '@colanode/mobile/theme/typography';

const MESSAGES_PER_PAGE = 50;

const createStyles = (palette: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: palette.background },
    listContent: { padding: spacing.md, gap: spacing.sm },
    row: { flexDirection: 'row', gap: spacing.sm, maxWidth: '85%' },
    rowOwn: { alignSelf: 'flex-end' },
    rowOther: { alignSelf: 'flex-start' },
    bubble: { padding: spacing.sm + 2, gap: 2 },
    bubbleOwn: {
      backgroundColor: palette.bubbleOwn,
      borderRadius: radius.bubble,
      borderBottomRightRadius: radius.bubbleAnchor,
    },
    bubbleOther: {
      backgroundColor: palette.bubbleOther,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.bubbleOtherBorder,
      borderRadius: radius.bubble,
      borderBottomLeftRadius: radius.bubbleAnchor,
    },
    sender: {
      ...typeScale.caption,
      fontFamily: fonts.bodyBold,
      color: palette.accent,
    },
    time: {
      fontFamily: fonts.mono,
      fontSize: 10,
      color: palette.textFaint,
      alignSelf: 'flex-end',
    },
    empty: {
      ...typeScale.body,
      color: palette.textMuted,
      textAlign: 'center',
      padding: spacing.xl,
      transform: [{ scaleY: -1 }],
    },
  });

const messageText = (message: LocalMessageNode): string => {
  const contents = mapBlocksToContents(
    message.id,
    Object.values(message.content ?? {})
  );
  const walk = (node: JSONContent): string =>
    node.type === 'text'
      ? (node.text ?? '')
      : (node.content ?? []).map(walk).join('');
  return contents.map(walk).join('\n');
};

const MessageRow = ({ message }: { message: LocalMessageNode }) => {
  const { workspace, collections } = useCurrentWorkspace();
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const own = message.createdBy === workspace.userId;

  const senderQuery = useLiveQuery(
    (q) =>
      q
        .from({ users: collections.users })
        .where(({ users }) => eq(users.id, message.createdBy))
        .findOne(),
    [message.createdBy]
  );
  const sender = senderQuery.data;

  const time = new Date(message.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const longPress = () => {
    const copy = () => Clipboard.setStringAsync(messageText(message));
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Copy', 'Cancel'], cancelButtonIndex: 1 },
        (index) => {
          if (index === 0) copy();
        }
      );
    } else {
      copy();
    }
  };

  return (
    <View
      style={[
        styles.row,
        own ? styles.rowOwn : styles.rowOther,
        { transform: [{ scaleY: -1 }] },
      ]}
    >
      {!own ? (
        <NodeAvatar
          id={message.createdBy}
          avatar={sender?.avatar}
          name={sender?.name}
          size={28}
        />
      ) : null}
      <Pressable
        style={[styles.bubble, own ? styles.bubbleOwn : styles.bubbleOther]}
        onLongPress={longPress}
        delayLongPress={300}
      >
        {!own ? (
          <Text style={styles.sender}>{sender?.name ?? 'Unnamed'}</Text>
        ) : null}
        <MessageContent message={message} />
        <Text style={styles.time}>{time}</Text>
      </Pressable>
    </View>
  );
};

type Props = NativeStackScreenProps<ChatsStackParamList, 'Conversation'>;

export const ConversationScreen = ({ route }: Props) => {
  const { nodeId } = route.params;
  const { workspace, collections } = useCurrentWorkspace();
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const radar = useRadar();

  const messagesQuery = useLiveInfiniteQuery(
    (q) =>
      q
        .from({ nodes: collections.nodes })
        .where(({ nodes }) => eq(nodes.type, 'message'))
        .where(({ nodes }) => eq(nodes.parentId, nodeId))
        .orderBy(({ nodes }) => nodes.id, 'desc'),
    {
      pageSize: MESSAGES_PER_PAGE,
      getNextPageParam: (lastPage, allPages) =>
        lastPage.length === MESSAGES_PER_PAGE ? allPages.length : undefined,
    },
    [workspace.userId, nodeId]
  );

  const messages = messagesQuery.data.map((node) => node as LocalMessageNode);

  // Newest message id: mark the conversation seen whenever it changes.
  const newestId = messages[0]?.id;
  useEffect(() => {
    radar.markNodeAsSeen(nodeId);
  }, [nodeId, newestId, radar]);

  const renderItem = useCallback(
    ({ item }: { item: LocalMessageNode }) => <MessageRow message={item} />,
    []
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 96 : 0}
    >
      <FlatList
        style={{ transform: [{ scaleY: -1 }] }}
        contentContainerStyle={styles.listContent}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (messagesQuery.hasNextPage && !messagesQuery.isFetchingNextPage) {
            messagesQuery.fetchNextPage();
          }
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>No messages yet. Say hello.</Text>
        }
        testID="message-list"
      />
      <MessageComposer conversationId={nodeId} />
    </KeyboardAvoidingView>
  );
};
