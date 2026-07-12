import { useMemo } from 'react';
import { Alert, Linking, StyleSheet, Text } from 'react-native';

import type { JSONContent } from '@tiptap/core';
import { mapBlocksToContents } from '@colanode/client/lib';
import type { LocalMessageNode } from '@colanode/client/types';
import { markStyle } from '@colanode/mobile/messages/mark-style';
import { type Palette } from '@colanode/mobile/theme/palette';
import { useTheme } from '@colanode/mobile/theme/theme-context';
import { spacing } from '@colanode/mobile/theme/tokens';
import { typeScale } from '@colanode/mobile/theme/typography';

const createStyles = (palette: Palette) =>
  StyleSheet.create({
    paragraph: { ...typeScale.body, color: palette.textPrimary },
    spacer: { height: spacing.xs },
    fallback: {
      ...typeScale.caption,
      color: palette.textMuted,
      fontStyle: 'italic',
    },
  });

const openLink = (href: string) => {
  // Message content is untrusted user input: only web links may leave the
  // app. Anything else (tel:, sms:, app schemes) is a link-injection vector.
  if (!/^https?:\/\//i.test(href)) {
    Alert.alert('Link blocked', 'Only web links can be opened from messages.');
    return;
  }
  Linking.openURL(href).catch(() =>
    Alert.alert('Could not open link', href)
  );
};

// Extracts the plain text of arbitrary unknown nodes so nothing ever renders
// as a hole — unsupported blocks degrade to their text content.
const textOf = (node: JSONContent): string => {
  if (node.type === 'text') return node.text ?? '';
  if (node.type === 'hardBreak') return '\n';
  return (node.content ?? []).map(textOf).join('');
};

const InlineNodes = ({
  nodes,
  palette,
}: {
  nodes: JSONContent[];
  palette: Palette;
}) => (
  <>
    {nodes.map((node, index) => {
      if (node.type === 'text') {
        const { style, href } = markStyle(node.marks, palette);
        return (
          <Text
            key={index}
            style={style}
            onPress={href ? () => openLink(href) : undefined}
          >
            {node.text ?? ''}
          </Text>
        );
      }
      if (node.type === 'hardBreak') {
        return <Text key={index}>{'\n'}</Text>;
      }
      if (node.type === 'mention') {
        const label =
          typeof node.attrs?.name === 'string' ? node.attrs.name : 'mention';
        return (
          <Text key={index} style={{ color: palette.accent }}>
            @{label}
          </Text>
        );
      }
      return <Text key={index}>{textOf(node)}</Text>;
    })}
  </>
);

export const MessageContent = ({ message }: { message: LocalMessageNode }) => {
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);

  const contents = useMemo(
    () => mapBlocksToContents(message.id, Object.values(message.content ?? {})),
    [message.id, message.content]
  );

  if (contents.length === 0) {
    return <Text style={styles.fallback}>empty message</Text>;
  }

  return (
    <>
      {contents.map((block, index) => {
        const inline = block.content ?? [];
        return (
          <Text key={block.attrs?.id ?? index} style={styles.paragraph}>
            <InlineNodes nodes={inline} palette={palette} />
          </Text>
        );
      })}
    </>
  );
};
