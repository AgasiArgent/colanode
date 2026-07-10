import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import {
  darkPalette,
  lightPalette,
  type Palette,
} from '@colanode/mobile/theme/palette';

interface Theme {
  palette: Palette;
  isDark: boolean;
}

// Mycel: dark is the primary theme — unknown/null schemes resolve to dark.
const ThemeContext = createContext<Theme>({ palette: darkPalette, isDark: true });

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const scheme = useColorScheme();
  const isDark = scheme !== 'light';

  const value = useMemo(
    () => ({ palette: isDark ? darkPalette : lightPalette, isDark }),
    [isDark]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
