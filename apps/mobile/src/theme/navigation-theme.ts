import type { Theme as NavigationTheme } from '@react-navigation/native';

import type { Palette } from '@colanode/mobile/theme/palette';
import { fonts } from '@colanode/mobile/theme/typography';

export const buildNavigationTheme = (
  palette: Palette,
  isDark: boolean
): NavigationTheme => ({
  dark: isDark,
  colors: {
    primary: palette.accent,
    background: palette.background,
    card: palette.surface,
    text: palette.textPrimary,
    border: palette.border,
    notification: palette.spore,
  },
  fonts: {
    regular: { fontFamily: fonts.body, fontWeight: '400' },
    medium: { fontFamily: fonts.bodyMedium, fontWeight: '500' },
    bold: { fontFamily: fonts.bodyBold, fontWeight: '700' },
    heavy: { fontFamily: fonts.heading, fontWeight: '700' },
  },
});
