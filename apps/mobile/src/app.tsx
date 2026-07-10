import {
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import {
  Karla_400Regular,
  Karla_500Medium,
  Karla_600SemiBold,
  Karla_700Bold,
} from '@expo-google-fonts/karla';
import {
  SplineSansMono_400Regular,
  SplineSansMono_500Medium,
  SplineSansMono_600SemiBold,
} from '@expo-google-fonts/spline-sans-mono';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { modelName } from 'expo-device';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppMeta, AppService } from '@colanode/client/services';
import { installColanodeShim } from '@colanode/mobile/data/install-shim';
import { copyAssets } from '@colanode/mobile/lib/assets';
import { RootNavigator } from '@colanode/mobile/navigation/root-navigator';
import { MobileFileSystem } from '@colanode/mobile/services/file-system';
import { MobileKyselyService } from '@colanode/mobile/services/kysely-service';
import { MobilePathService } from '@colanode/mobile/services/path-service';
import { MobilePushService } from '@colanode/mobile/services/push-service';
import { buildNavigationTheme } from '@colanode/mobile/theme/navigation-theme';
import { type Palette } from '@colanode/mobile/theme/palette';
import { ThemeProvider, useTheme } from '@colanode/mobile/theme/theme-context';
import { radius, spacing } from '@colanode/mobile/theme/tokens';
import { typeScale } from '@colanode/mobile/theme/typography';
import { buildQueryClient } from '@colanode/ui/lib/query';

const createStyles = (palette: Palette) =>
  StyleSheet.create({
    loading: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.background,
    },
    errorContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      padding: spacing.lg,
      backgroundColor: palette.background,
    },
    errorTitle: {
      ...typeScale.h2,
      color: palette.textPrimary,
      textAlign: 'center',
    },
    errorMessage: {
      ...typeScale.body,
      color: palette.textSecondary,
      textAlign: 'center',
    },
    errorRetryButton: {
      marginTop: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      borderRadius: radius.md,
      backgroundColor: palette.accent,
      minHeight: 48,
      minWidth: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    errorRetryText: {
      ...typeScale.body,
      fontFamily: typeScale.body.fontFamily,
      fontWeight: '700',
      color: palette.accentForeground,
    },
  });

// React Native's `global`/`window` is not a DOM EventTarget, so it has no
// `addEventListener('error' | 'unhandledrejection', ...)`. The native-side
// equivalent for uncaught JS exceptions is `ErrorUtils`. We chain through the
// previously installed handler (RN's own redbox/exception reporter) so
// behavior is unchanged — we only add a loud, contextual log on top of it.
const defaultErrorHandler = ErrorUtils.getGlobalHandler();
ErrorUtils.setGlobalHandler((error, isFatal) => {
  console.error('[Mobile] Uncaught global error', error, { isFatal });
  defaultErrorHandler(error, isFatal);
});

interface MobileErrorStateProps {
  testID: string;
  title: string;
  message: string;
  retryTestID: string;
  onRetry: () => void;
}

const MobileErrorState = ({
  testID,
  title,
  message,
  retryTestID,
  onRetry,
}: MobileErrorStateProps) => {
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <View testID={testID} style={styles.errorContainer}>
      <Text style={styles.errorTitle}>{title}</Text>
      <Text style={styles.errorMessage}>{message}</Text>
      <Pressable
        testID={retryTestID}
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Try again"
        style={styles.errorRetryButton}
      >
        <Text style={styles.errorRetryText}>Try again</Text>
      </Pressable>
    </View>
  );
};

interface MobileErrorBoundaryState {
  error: Error | null;
}

// Wraps the native app tree so a render-time error shows a visible,
// test-observable failure state instead of a blank screen — the React Native
// counterpart of the shared web AppErrorBoundary.
class MobileErrorBoundary extends Component<
  { children: ReactNode },
  MobileErrorBoundaryState
> {
  state: MobileErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): MobileErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(
      '[Mobile] Uncaught render error in app tree',
      error,
      errorInfo.componentStack
    );
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) {
      return this.props.children;
    }

    return (
      <MobileErrorState
        testID="app-error-boundary"
        title="Something went wrong"
        message={error.message || 'The app ran into an unexpected error.'}
        retryTestID="app-error-boundary-retry-button"
        onRetry={this.reset}
      />
    );
  }
}

type BootState =
  | { phase: 'initializing' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; queryClient: QueryClient };

export const App = () => (
  <ThemeProvider>
    <AppBootstrap />
  </ThemeProvider>
);

const AppBootstrap = () => {
  const { palette, isDark } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    Karla_400Regular,
    Karla_500Medium,
    Karla_600SemiBold,
    Karla_700Bold,
    SplineSansMono_400Regular,
    SplineSansMono_500Medium,
    SplineSansMono_600SemiBold,
  });

  const app = useRef<AppService | null>(null);
  const pushService = useRef(new MobilePushService()).current;
  const [boot, setBoot] = useState<BootState>({ phase: 'initializing' });

  const initialize = useCallback(async () => {
    setBoot({ phase: 'initializing' });
    try {
      const paths = new MobilePathService();
      await copyAssets(paths);

      const appMeta: AppMeta = {
        type: 'mobile',
        platform: modelName ?? 'unknown',
      };

      const appService = new AppService(
        appMeta,
        new MobileFileSystem(),
        new MobileKyselyService(),
        paths
      );

      await appService.migrate();
      await appService.init();

      app.current = appService;
      // Order matters: buildQueryClient() subscribes to window.eventBus,
      // which the shim assigns.
      installColanodeShim(appService, pushService);
      setBoot({ phase: 'ready', queryClient: buildQueryClient() });
    } catch (error) {
      console.error('[Mobile] App initialization failed', error);
      setBoot({
        phase: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to initialize the app.',
      });
    }
  }, [pushService]);

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (!fontsLoaded || boot.phase === 'initializing') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator testID="app-loading-indicator" color={palette.accent} />
      </View>
    );
  }

  if (boot.phase === 'error') {
    return (
      <MobileErrorState
        testID="app-init-error"
        title="Failed to start"
        message={boot.message}
        retryTestID="app-init-error-retry-button"
        onRetry={initialize}
      />
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <MobileErrorBoundary>
        <QueryClientProvider client={boot.queryClient}>
          <NavigationContainer theme={buildNavigationTheme(palette, isDark)}>
            <RootNavigator />
          </NavigationContainer>
        </QueryClientProvider>
      </MobileErrorBoundary>
    </SafeAreaProvider>
  );
};
