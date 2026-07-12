import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextStyle,
} from 'react-native';

import type { JSONContent } from '@tiptap/core';
import { FileBlockView } from '@colanode/mobile/documents/file-block-view';
import { InlineNodes, textOf } from '@colanode/mobile/documents/inline-nodes';
import { type Palette } from '@colanode/mobile/theme/palette';
import { useTheme } from '@colanode/mobile/theme/theme-context';
import { radius, spacing } from '@colanode/mobile/theme/tokens';
import { fonts, typeScale } from '@colanode/mobile/theme/typography';

// Node types that only ever appear inline — handled by InlineNodes, never as
// blocks. Anything else nested under an unknown block is treated as a block.
const INLINE_TYPES = new Set(['text', 'hardBreak', 'mention']);

const createStyles = (palette: Palette) =>
  StyleSheet.create({
    paragraph: { ...typeScale.body, color: palette.textPrimary },
    h1: { ...typeScale.h1, color: palette.textPrimary, marginTop: spacing.lg },
    h2: { ...typeScale.h2, color: palette.textPrimary, marginTop: spacing.md },
    h3: { ...typeScale.h3, color: palette.textPrimary, marginTop: spacing.md },
    blockquote: {
      borderLeftWidth: 3,
      borderLeftColor: palette.accentSoft,
      paddingLeft: spacing.md,
      gap: spacing.xs,
    },
    list: { gap: spacing.xs },
    listRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
    },
    listMarker: {
      ...typeScale.body,
      fontFamily: fonts.mono,
      color: palette.textMuted,
      minWidth: 22,
    },
    taskIcon: { marginTop: 1 },
    listBody: { flex: 1, gap: spacing.xs },
    taskChecked: {
      color: palette.textMuted,
      textDecorationLine: 'line-through',
    },
    codeBlock: {
      backgroundColor: palette.surface,
      borderRadius: radius.md,
      padding: spacing.md,
    },
    codeText: {
      fontFamily: fonts.mono,
      fontSize: typeScale.code.fontSize,
      lineHeight: typeScale.code.lineHeight,
      color: palette.textPrimary,
    },
    hr: {
      height: 1,
      backgroundColor: palette.border,
      marginVertical: spacing.md,
    },
    tableRow: { flexDirection: 'row' },
    tableCell: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.border,
      minWidth: 120,
      padding: spacing.sm,
    },
    tableHeaderCell: { backgroundColor: palette.surface },
    tableHeaderText: { fontFamily: fonts.bodyBold },
  });

type Styles = ReturnType<typeof createStyles>;

const isBlockLevel = (node: JSONContent): boolean =>
  typeof node.type === 'string' && !INLINE_TYPES.has(node.type);

const ListItem = ({
  item,
  ordered,
  index,
  depth,
}: {
  item: JSONContent;
  ordered: boolean;
  index: number;
  depth: number;
}) => {
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const children = item.content ?? [];
  return (
    <View style={styles.listRow}>
      <Text style={styles.listMarker}>{ordered ? `${index + 1}.` : '•'}</Text>
      <View style={styles.listBody}>
        {children.map((child, i) => (
          <BlockRenderer
            key={child.attrs?.id ?? i}
            block={child}
            depth={depth + 1}
          />
        ))}
      </View>
    </View>
  );
};

const TaskItem = ({
  item,
  depth,
}: {
  item: JSONContent;
  depth: number;
}) => {
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const checked = item.attrs?.checked === true;
  const children = item.content ?? [];
  return (
    <View style={styles.listRow}>
      <Ionicons
        name={checked ? 'checkbox' : 'square-outline'}
        size={18}
        color={checked ? palette.accent : palette.textMuted}
        style={styles.taskIcon}
      />
      <View style={styles.listBody}>
        {children.map((child, i) => (
          <BlockRenderer
            key={child.attrs?.id ?? i}
            block={child}
            depth={depth + 1}
            textStyle={checked ? styles.taskChecked : undefined}
          />
        ))}
      </View>
    </View>
  );
};

const TableCell = ({ cell, styles }: { cell: JSONContent; styles: Styles }) => {
  const header = cell.type === 'tableHeader';
  const children = cell.content ?? [];
  return (
    <View style={[styles.tableCell, header && styles.tableHeaderCell]}>
      {children.map((child, i) => (
        <BlockRenderer
          key={child.attrs?.id ?? i}
          block={child}
          textStyle={header ? styles.tableHeaderText : undefined}
        />
      ))}
    </View>
  );
};

// shortcut: colspan/rowspan ignored — cells render as a plain flat grid.
// Upgrade to honor cell spans if real tables demand it.
const TableView = ({ table }: { table: JSONContent }) => {
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const rows = table.content ?? [];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View>
        {rows.map((row, ri) => (
          <View key={row.attrs?.id ?? ri} style={styles.tableRow}>
            {(row.content ?? []).map((cell, ci) => (
              <TableCell
                key={cell.attrs?.id ?? ci}
                cell={cell}
                styles={styles}
              />
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

export const BlockRenderer = ({
  block,
  depth = 0,
  textStyle,
}: {
  block: JSONContent;
  depth?: number;
  textStyle?: TextStyle;
}) => {
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const children = block.content ?? [];

  switch (block.type) {
    case 'paragraph':
      return (
        <Text style={[styles.paragraph, textStyle]}>
          <InlineNodes nodes={children} palette={palette} textStyle={textStyle} />
        </Text>
      );
    case 'heading1':
    case 'heading2':
    case 'heading3': {
      const headingStyle =
        block.type === 'heading1'
          ? styles.h1
          : block.type === 'heading2'
            ? styles.h2
            : styles.h3;
      return (
        <Text style={headingStyle}>
          <InlineNodes nodes={children} palette={palette} />
        </Text>
      );
    }
    case 'blockquote':
      return (
        <View style={styles.blockquote}>
          {children.map((child, i) => (
            <BlockRenderer
              key={child.attrs?.id ?? i}
              block={child}
              depth={depth + 1}
            />
          ))}
        </View>
      );
    case 'bulletList':
    case 'orderedList':
      return (
        <View style={styles.list}>
          {children.map((item, i) => (
            <ListItem
              key={item.attrs?.id ?? i}
              item={item}
              ordered={block.type === 'orderedList'}
              index={i}
              depth={depth}
            />
          ))}
        </View>
      );
    case 'taskList':
      return (
        <View style={styles.list}>
          {children.map((item, i) => (
            <TaskItem key={item.attrs?.id ?? i} item={item} depth={depth} />
          ))}
        </View>
      );
    case 'codeBlock':
      // shortcut: no syntax highlighting — renders raw concatenated text.
      // Add a tokenizer/highlighter later if wanted.
      return (
        <View style={styles.codeBlock}>
          <Text style={styles.codeText}>{textOf(block)}</Text>
        </View>
      );
    case 'horizontalRule':
      return <View style={styles.hr} />;
    case 'table':
      return <TableView table={block} />;
    case 'file': {
      const fileId =
        typeof block.attrs?.id === 'string' ? block.attrs.id : null;
      if (!fileId) return null;
      return <FileBlockView fileId={fileId} />;
    }
    default: {
      // Unknown block: recurse into block-level children so nested content still
      // renders; otherwise degrade to the block's flattened text. Never crash.
      if (children.some(isBlockLevel)) {
        return (
          <View style={styles.list}>
            {children.map((child, i) => (
              <BlockRenderer
                key={child.attrs?.id ?? i}
                block={child}
                depth={depth + 1}
              />
            ))}
          </View>
        );
      }
      const text = textOf(block);
      if (!text) return null;
      return <Text style={[styles.paragraph, textStyle]}>{text}</Text>;
    }
  }
};
