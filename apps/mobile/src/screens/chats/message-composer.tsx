import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { useCurrentWorkspace } from '@colanode/mobile/session/current-workspace-context';
import { type Palette } from '@colanode/mobile/theme/palette';
import { useTheme } from '@colanode/mobile/theme/theme-context';
import { radius, spacing } from '@colanode/mobile/theme/tokens';
import { fonts } from '@colanode/mobile/theme/typography';
import { useMutation } from '@colanode/ui/hooks/use-mutation';

const createStyles = (palette: Palette) =>
  StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
      padding: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: palette.border,
      backgroundColor: palette.surface,
    },
    input: {
      flex: 1,
      maxHeight: 120,
      minHeight: 40,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.lg,
      backgroundColor: palette.background,
      borderWidth: 1,
      borderColor: palette.border,
      color: palette.textPrimary,
      fontFamily: fonts.body,
      fontSize: 15,
    },
    send: {
      width: 40,
      height: 40,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

export const MessageComposer = ({ conversationId }: { conversationId: string }) => {
  const { workspace } = useCurrentWorkspace();
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const { isPending, mutate } = useMutation();
  const [text, setText] = useState('');

  const canSend = text.trim().length > 0 && !isPending;

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    // Plain-text M3 composer: one paragraph per line. The mutation handler
    // converts this TipTap doc into the block map (mapContentsToBlocks).
    const content = {
      type: 'doc',
      content: trimmed.split('\n').map((line) => ({
        type: 'paragraph',
        content: line.length > 0 ? [{ type: 'text', text: line }] : [],
      })),
    };
    setText('');
    mutate({
      input: {
        type: 'message.create',
        userId: workspace.userId,
        parentId: conversationId,
        content,
      },
      onError: (error) => {
        setText(trimmed);
        Alert.alert('Message not sent', error.message);
      },
    });
  };

  return (
    <View style={styles.bar}>
      <TextInput
        style={styles.input}
        multiline
        placeholder="Message"
        placeholderTextColor={palette.textFaint}
        value={text}
        onChangeText={setText}
        testID="message-input"
      />
      <Pressable
        style={[
          styles.send,
          { backgroundColor: canSend ? palette.accent : palette.surface },
        ]}
        disabled={!canSend}
        accessibilityRole="button"
        accessibilityLabel="Send"
        onPress={send}
        testID="message-send"
      >
        <Ionicons
          name="arrow-up"
          size={20}
          color={canSend ? palette.accentForeground : palette.textFaint}
        />
      </Pressable>
    </View>
  );
};
