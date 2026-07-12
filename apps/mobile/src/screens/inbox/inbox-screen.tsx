import { eq, useLiveQuery as useDbLiveQuery } from '@tanstack/react-db';
import { useNavigation } from '@react-navigation/native';
import { type BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useMemo } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import type { SelectNotification } from '@colanode/client/databases/workspace';
import { NodeAvatar } from '@colanode/mobile/components/node-avatar';
import {
  conversationTitle,
  formatRelativeTime,
  notificationLabel,
} from '@colanode/mobile/inbox/notification-display';
import { type RootTabParamList } from '@colanode/mobile/navigation/root-navigator';
import { useCurrentWorkspace } from '@colanode/mobile/session/current-workspace-context';
import { type Palette } from '@colanode/mobile/theme/palette';
import { useTheme } from '@colanode/mobile/theme/theme-context';
import { radius, spacing } from '@colanode/mobile/theme/tokens';
import { fonts, typeScale } from '@colanode/mobile/theme/typography';
import { useLiveQuery } from '@colanode/ui/hooks/use-live-query';
import { useMutation } from '@colanode/ui/hooks/use-mutation';

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
    line: { ...typeScale.body, color: palette.textSecondary },
    actor: { fontFamily: fonts.bodyBold, color: palette.textPrimary },
    target: { fontFamily: fonts.bodyMedium, color: palette.textPrimary },
    time: { fontFamily: fonts.mono, fontSize: 11, color: palette.textFaint },
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

const NotificationRow = ({
  notification,
}: {
  notification: SelectNotification;
}) => {
  const { workspace, collections } = useCurrentWorkspace();
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const navigation =
    useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const { mutate } = useMutation();

  const actorQuery = useDbLiveQuery(
    (q) =>
      q
        .from({ users: collections.users })
        .where(({ users }) => eq(users.id, notification.actor_id ?? ''))
        .findOne(),
    [notification.actor_id]
  );
  const rootQuery = useDbLiveQuery(
    (q) =>
      q
        .from({ nodes: collections.nodes })
        .where(({ nodes }) => eq(nodes.id, notification.root_id))
        .findOne(),
    [notification.root_id]
  );
  const usersQuery = useDbLiveQuery(
    (q) => q.from({ users: collections.users }),
    []
  );

  const actor = actorQuery.data;
  const root = rootQuery.data;
  const unread = notification.read_at === null;
  const title = conversationTitle(
    root,
    usersQuery.data ?? [],
    workspace.userId
  );

  const open = () => {
    if (unread) {
      mutate({
        input: {
          type: 'notification.read',
          userId: workspace.userId,
          notificationId: notification.id,
        },
        onError: (error) => Alert.alert('Could not mark as read', error.message),
      });
    }
    if (root && (root.type === 'chat' || root.type === 'channel')) {
      navigation.navigate('Chats', {
        screen: 'Conversation',
        params: { nodeId: notification.root_id, title },
      });
    } else {
      Alert.alert(
        'Not available on mobile yet',
        'Open this on desktop or web to see it.'
      );
    }
  };

  return (
    <Pressable
      style={styles.row}
      accessibilityRole="button"
      testID={`notification-${notification.id}`}
      onPress={open}
    >
      <NodeAvatar
        id={notification.actor_id ?? notification.id}
        avatar={actor?.avatar}
        name={actor?.name}
        size={36}
      />
      <View style={styles.text}>
        <Text style={styles.line} numberOfLines={2}>
          <Text style={styles.actor}>{actor?.name ?? 'Someone'}</Text>
          {` ${notificationLabel(notification.type)} in `}
          <Text style={styles.target}>{title}</Text>
        </Text>
        <Text style={styles.time}>
          {formatRelativeTime(notification.created_at, new Date())}
        </Text>
      </View>
      {unread ? <View style={styles.dot} /> : null}
    </Pressable>
  );
};

export const InboxScreen = () => {
  const { workspace } = useCurrentWorkspace();
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const notificationList = useLiveQuery({
    type: 'notification.list',
    userId: workspace.userId,
  });

  return (
    <FlatList
      style={styles.list}
      testID="inbox-list"
      data={notificationList.data ?? []}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <NotificationRow notification={item} />}
      ListEmptyComponent={
        <Text style={styles.empty}>You're all caught up.</Text>
      }
    />
  );
};
