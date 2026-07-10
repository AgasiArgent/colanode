import {
  ActivityIndicator,
  Pressable,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { type Palette } from '@colanode/mobile/theme/palette';
import { useTheme } from '@colanode/mobile/theme/theme-context';
import { radius, spacing } from '@colanode/mobile/theme/tokens';
import { fonts } from '@colanode/mobile/theme/typography';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type ButtonSize = 'md' | 'sm';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

const colorsFor = (
  palette: Palette,
  variant: ButtonVariant,
  pressed: boolean
) => {
  switch (variant) {
    case 'primary':
      return {
        bg: pressed ? palette.accentActive : palette.accent,
        fg: palette.accentForeground,
        border: 'transparent',
      };
    case 'secondary':
      return {
        bg: palette.surface,
        fg: palette.textPrimary,
        border: palette.border,
      };
    case 'ghost':
      return { bg: 'transparent', fg: palette.accent, border: 'transparent' };
    case 'destructive':
      return {
        bg: pressed ? palette.dangerActive : palette.danger,
        fg: palette.dangerForeground,
        border: 'transparent',
      };
  }
};

export const Button = ({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  testID,
  style,
}: ButtonProps) => {
  const { palette } = useTheme();

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => {
        const colors = colorsFor(palette, variant, pressed);
        return [
          {
            minHeight: size === 'md' ? 48 : 36,
            paddingHorizontal: size === 'md' ? spacing.lg : spacing.md,
            borderRadius: radius.md,
            backgroundColor: colors.bg,
            borderWidth: variant === 'secondary' ? 1 : 0,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: spacing.sm,
            opacity: disabled ? 0.4 : 1,
            transform: [{ scale: pressed && !disabled && !loading ? 0.96 : 1 }],
          },
          style,
        ];
      }}
    >
      {({ pressed }) => {
        const colors = colorsFor(palette, variant, pressed);
        return (
          <>
            {loading ? (
              <ActivityIndicator size="small" color={colors.fg} />
            ) : null}
            <Text
              style={{
                fontFamily: fonts.bodySemiBold,
                fontSize: size === 'md' ? 15 : 13,
                color: colors.fg,
              }}
            >
              {label}
            </Text>
          </>
        );
      }}
    </Pressable>
  );
};
