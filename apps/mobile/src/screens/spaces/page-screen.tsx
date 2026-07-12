import { eq, useLiveQuery } from '@tanstack/react-db';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
import {
  IslandHost,
  type IslandHostHandle,
} from '@colanode/mobile/island/island-host';
import { EditorToolbar } from '@colanode/mobile/island/editor-toolbar';
import { type SpacesStackParamList } from '@colanode/mobile/navigation/spaces-navigator';
import { useCurrentWorkspace } from '@colanode/mobile/session/current-workspace-context';
import { type Palette } from '@colanode/mobile/theme/palette';
import { useTheme } from '@colanode/mobile/theme/theme-context';
import { spacing } from '@colanode/mobile/theme/tokens';
import { typeScale } from '@colanode/mobile/theme/typography';

// The native viewer already live-reflects saved content through M6's
// useDocumentContent, so nothing extra runs when the island reports a save.
const noop = () => {};

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
    headerButton: {
      ...typeScale.body,
      color: palette.accent,
      paddingHorizontal: spacing.xs,
    },
  });

type Props = NativeStackScreenProps<SpacesStackParamList, 'Page'>;

export const PageScreen = ({ route, navigation }: Props) => {
  const { nodeId } = route.params;
  const { collections, workspace } = useCurrentWorkspace();
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);

  const hostRef = useRef<IslandHostHandle>(null);
  const [editing, setEditing] = useState(false);

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

  // shortcut: gate Edit on workspace role, not the node-level role the web
  // computes via extractNodeRole(root, userId) — document-service.canUpdateDocument
  // remains the authoritative check and rejects unauthorized saves loudly (per
  // M7 plan Global Constraints). Upgrade path: resolve the root node and reuse
  // extractNodeRole once a root-node lookup exists on mobile.
  const canEdit =
    node != null && workspace.role !== 'guest' && workspace.role !== 'none';

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: canEdit
        ? () => (
            <Pressable
              onPress={() => setEditing((value) => !value)}
              accessibilityRole="button"
              accessibilityLabel={editing ? 'Done editing' : 'Edit page'}
              testID="page-edit-toggle"
              hitSlop={8}
            >
              <Text style={styles.headerButton}>
                {editing ? 'Done' : 'Edit'}
              </Text>
            </Pressable>
          )
        : undefined,
    });
  }, [navigation, editing, canEdit, styles.headerButton]);

  if (editing && node) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 96 : 0}
      >
        <IslandHost ref={hostRef} node={node} onSaved={noop} />
        <EditorToolbar onCommand={(command) => hostRef.current?.sendCommand(command)} />
      </KeyboardAvoidingView>
    );
  }

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
