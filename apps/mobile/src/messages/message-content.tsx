import { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';

import { mapBlocksToContents } from '@colanode/client/lib';
import type { LocalMessageNode } from '@colanode/client/types';
import { InlineNodes } from '@colanode/mobile/documents/inline-nodes';
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
