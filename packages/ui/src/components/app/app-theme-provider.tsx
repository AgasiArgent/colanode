import { useEffect } from 'react';

import { AppInitOutput, ThemeMode } from '@colanode/client/types';
import { ThemeContext } from '@colanode/ui/contexts/theme';
import { useMetadata } from '@colanode/ui/hooks/use-metadata';
import { useSystemTheme } from '@colanode/ui/hooks/use-system-theme';
import { getThemeVariables } from '@colanode/ui/lib/themes';

const useApplyTheme = (mode: ThemeMode) => {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const htmlElement = document.documentElement;

    if (mode === 'dark') {
      htmlElement.classList.add('dark');
    } else {
      htmlElement.classList.remove('dark');
    }

    // Ensure cleanup removes the class on unmount or before next effect
    return () => {
      htmlElement.classList.remove('dark');
    };
  }, [mode]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const themeVariables = getThemeVariables(mode);
    const htmlElement = document.documentElement;

    Object.entries(themeVariables).forEach(([key, value]) => {
      htmlElement.style.setProperty(key, value);
    });
  }, [mode]);
};

const AppThemeProviderInitialized = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const systemTheme = useSystemTheme();

  const [themeMode] = useMetadata<ThemeMode>('app', 'theme.mode');

  const resolvedThemeMode = themeMode ?? systemTheme;

  useApplyTheme(resolvedThemeMode);

  return (
    <ThemeContext.Provider value={{ mode: resolvedThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const AppThemeProviderUninitialized = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const systemTheme = useSystemTheme();
  useApplyTheme(systemTheme);

  return (
    <ThemeContext.Provider value={{ mode: systemTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const AppThemeProvider = ({
  children,
  init,
}: {
  children: React.ReactNode;
  init: AppInitOutput | null;
}) => {
  if (init !== 'success') {
    return (
      <AppThemeProviderUninitialized>{children}</AppThemeProviderUninitialized>
    );
  }

  return <AppThemeProviderInitialized>{children}</AppThemeProviderInitialized>;
};
