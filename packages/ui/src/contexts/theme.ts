import { createContext, useContext } from 'react';

import { ThemeMode } from '@colanode/client/types';

interface ThemeContext {
  mode: ThemeMode;
}

export const ThemeContext = createContext<ThemeContext>({} as ThemeContext);

export const useTheme = () => useContext(ThemeContext);
