import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import type { EditorCommand } from '@colanode/mobile/island/island-messages';
import { type Palette } from '@colanode/mobile/theme/palette';
import { useTheme } from '@colanode/mobile/theme/theme-context';
import { radius, spacing } from '@colanode/mobile/theme/tokens';

// The formatting buttons, in bar order. Ionicons (used elsewhere in the app) has
// no text-formatting glyphs, so the toolbar draws from MaterialCommunityIcons'
// purpose-built `format-*` set — same `@expo/vector-icons` package, no new dep.
// shortcut: no active-state highlighting yet — island->native selection-state
// sync is a later pass (M7 v1 ceiling, per plan).
const BUTTONS: {
  command: EditorCommand;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
}[] = [
  { command: 'bold', icon: 'format-bold', label: 'Bold' },
  { command: 'italic', icon: 'format-italic', label: 'Italic' },
  { command: 'strike', icon: 'format-strikethrough', label: 'Strikethrough' },
  { command: 'code', icon: 'code-tags', label: 'Code' },
  { command: 'heading1', icon: 'format-header-1', label: 'Heading 1' },
  { command: 'heading2', icon: 'format-header-2', label: 'Heading 2' },
  { command: 'bulletList', icon: 'format-list-bulleted', label: 'Bullet list' },
  { command: 'taskList', icon: 'format-list-checks', label: 'Task list' },
  { command: 'undo', icon: 'undo', label: 'Undo' },
  { command: 'redo', icon: 'redo', label: 'Redo' },
];

const createStyles = (palette: Palette) =>
  StyleSheet.create({
    bar: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: palette.border,
      backgroundColor: palette.surface,
    },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    button: {
      width: 44,
      height: 44,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

interface EditorToolbarProps {
  onCommand: (command: EditorCommand) => void;
}

export const EditorToolbar = ({ onCommand }: EditorToolbarProps) => {
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <ScrollView
      style={styles.bar}
      contentContainerStyle={styles.content}
      horizontal
      keyboardShouldPersistTaps="always"
      showsHorizontalScrollIndicator={false}
      testID="editor-toolbar"
    >
      {BUTTONS.map((button) => (
        <Pressable
          key={button.command}
          style={styles.button}
          accessibilityRole="button"
          accessibilityLabel={button.label}
          testID={`editor-toolbar-${button.command}`}
          onPress={() => onCommand(button.command)}
        >
          <MaterialCommunityIcons
            name={button.icon}
            size={22}
            color={palette.textSecondary}
          />
        </Pressable>
      ))}
    </ScrollView>
  );
};
