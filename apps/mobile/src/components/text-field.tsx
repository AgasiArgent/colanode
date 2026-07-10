import { useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { type Palette } from '@colanode/mobile/theme/palette';
import { useTheme } from '@colanode/mobile/theme/theme-context';
import { radius, spacing } from '@colanode/mobile/theme/tokens';
import { fonts, typeScale } from '@colanode/mobile/theme/typography';

interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string;
  mono?: boolean;
}

const createStyles = (palette: Palette) =>
  StyleSheet.create({
    container: { gap: spacing.xs },
    label: {
      ...typeScale.caption,
      fontFamily: fonts.bodyMedium,
      color: palette.textSecondary,
    },
    input: {
      minHeight: 48,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      backgroundColor: palette.surface,
      color: palette.textPrimary,
      fontSize: 15,
    },
    error: { ...typeScale.caption, color: palette.danger },
  });

export const TextField = ({
  label,
  error,
  mono,
  style,
  onFocus,
  onBlur,
  ...inputProps
}: TextFieldProps) => {
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? palette.danger
    : focused
      ? palette.accent
      : palette.border;

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        {...inputProps}
        style={[
          styles.input,
          { borderColor, fontFamily: mono ? fonts.mono : fonts.body },
          style,
        ]}
        placeholderTextColor={palette.textFaint}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
};
