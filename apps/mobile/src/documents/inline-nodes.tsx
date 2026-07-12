import { Alert, Linking, Text, type TextStyle } from 'react-native';

import type { JSONContent } from '@tiptap/core';
import { markStyle } from '@colanode/mobile/documents/mark-style';
import { type Palette } from '@colanode/mobile/theme/palette';

export const openLink = (href: string) => {
  // Document/message content is untrusted user input: only web links may leave
  // the app. Anything else (tel:, sms:, app schemes) is a link-injection vector.
  if (!/^https?:\/\//i.test(href)) {
    Alert.alert('Link blocked', 'Only web links can be opened from messages.');
    return;
  }
  Linking.openURL(href).catch(() => Alert.alert('Could not open link', href));
};

// Extracts the plain text of arbitrary unknown nodes so nothing ever renders
// as a hole — unsupported blocks degrade to their text content.
export const textOf = (node: JSONContent): string => {
  if (node.type === 'text') return node.text ?? '';
  if (node.type === 'hardBreak') return '\n';
  return (node.content ?? []).map(textOf).join('');
};

// Renders a run of inline nodes (text leaves + marks, hardBreaks, mentions).
// `textStyle` is an optional base style inherited by every leaf so callers
// (block renderer) can tint whole runs — e.g. checked task items go muted.
export const InlineNodes = ({
  nodes,
  palette,
  textStyle,
}: {
  nodes: JSONContent[];
  palette: Palette;
  textStyle?: TextStyle;
}) => (
  <>
    {nodes.map((node, index) => {
      if (node.type === 'text') {
        const { style, href } = markStyle(node.marks, palette);
        return (
          <Text
            key={index}
            style={[textStyle, style]}
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
          <Text key={index} style={[textStyle, { color: palette.accent }]}>
            @{label}
          </Text>
        );
      }
      return (
        <Text key={index} style={textStyle}>
          {textOf(node)}
        </Text>
      );
    })}
  </>
);
