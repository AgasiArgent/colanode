import { eq, useLiveQuery } from '@tanstack/react-db';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { JSONContent } from '@tiptap/core';
import type { LocalNode } from '@colanode/client/types';
import { BlockRenderer } from '@colanode/mobile/documents/block-renderer';
import { textOf } from '@colanode/mobile/documents/inline-nodes';
import { useDocumentContent } from '@colanode/mobile/documents/use-document-content';
import { type SpacesStackParamList } from '@colanode/mobile/navigation/spaces-navigator';
import { useCurrentWorkspace } from '@colanode/mobile/session/current-workspace-context';
import { type Palette } from '@colanode/mobile/theme/palette';
import { useTheme } from '@colanode/mobile/theme/theme-context';
import { spacing } from '@colanode/mobile/theme/tokens';
import { typeScale } from '@colanode/mobile/theme/typography';

const nodeName = (node: LocalNode | undefined): string =>
  ((node as { name?: string | null } | undefined)?.name ?? '').trim() ||
  'Untitled';

// `buildEditorContent` always yields at least a fallback empty paragraph, so a
// brand-new page arrives as a single empty paragraph rather than an empty array
// — treat that as an empty document.
const isDocumentEmpty = (blocks: JSONContent[]): boolean =>
  blocks.length === 0 ||
  (blocks.length === 1 &&
    blocks[0]?.type === 'paragraph' &&
    textOf(blocks[0]) === '');

const createStyles = (palette: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: palette.background },
    content: { padding: spacing.md, gap: spacing.sm },
    title: { ...typeScale.h1, color: palette.textPrimary },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.background,
    },
    empty: {
      ...typeScale.body,
      color: palette.textMuted,
    },
  });

type Props = NativeStackScreenProps<SpacesStackParamList, 'Page'>;

export const PageScreen = ({ route }: Props) => {
  const { nodeId } = route.params;
  const { collections } = useCurrentWorkspace();
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);

  const nodeQuery = useLiveQuery(
    (q) =>
      q
        .from({ nodes: collections.nodes })
        .where(({ nodes }) => eq(nodes.id, nodeId))
        .findOne(),
    [nodeId]
  );
  const { blocks, isPending } = useDocumentContent(nodeId);

  const node = nodeQuery.data as LocalNode | undefined;

  if (isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.accent} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{nodeName(node)}</Text>
      {isDocumentEmpty(blocks) ? (
        <Text style={styles.empty}>This page is empty.</Text>
      ) : (
        blocks.map((block, index) => (
          <BlockRenderer key={block.attrs?.id ?? index} block={block} />
        ))
      )}
    </ScrollView>
  );
};
