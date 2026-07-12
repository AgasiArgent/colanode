import { Asset } from 'expo-asset';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import type {
  ShouldStartLoadRequest,
  WebViewErrorEvent,
  WebViewHttpErrorEvent,
} from 'react-native-webview/lib/WebViewTypes';
import superjson from 'superjson';

import { eventBus } from '@colanode/client/lib';
import { MutationErrorCode } from '@colanode/client/mutations';
import type { LocalNode } from '@colanode/client/types';
import type {
  ConsoleMessage,
  EditorCommand,
  IslandToNativeMessage,
  NativeToIslandMessage,
} from '@colanode/mobile/island/island-messages';
import { editorHtmlAsset } from '@colanode/mobile/lib/assets';
import { useCurrentWorkspace } from '@colanode/mobile/session/current-workspace-context';
import { type Palette } from '@colanode/mobile/theme/palette';
import { useTheme } from '@colanode/mobile/theme/theme-context';
import { radius, spacing } from '@colanode/mobile/theme/tokens';
import { typeScale } from '@colanode/mobile/theme/typography';

// The island script has to install its bridge, preload the ui collections over
// that bridge, and mount the shared TipTap editor. Cold, this can take a few
// seconds; budget 30s before surfacing a retry (mirrors the pre-M1 init budget).
const EDITOR_READY_TIMEOUT_MS = 30000;

// Writes the island may execute. The island renders collaborator-authored
// document content inside a WebView that holds the data bridge, so the bridge
// must not expose the whole mediator for mutations — reads are local data the
// user already has, writes are allowlisted. Extend deliberately per feature.
const ALLOWED_MUTATIONS = new Set<string>([
  'document.update',
  'node.interaction.seen',
  'node.interaction.opened',
]);

export interface IslandHostHandle {
  sendCommand: (command: EditorCommand) => void;
}

interface IslandHostProps {
  node: LocalNode;
  onSaved: () => void;
}

// Pipe island console lines to Metro, prefixed so they are distinguishable from
// native logs (the island already forwards them across the bridge).
const logIsland = (level: ConsoleMessage['level'], message: string) => {
  const line = `[Island ${level.toUpperCase()}] ${message}`;
  switch (level) {
    case 'log':
      console.log(line);
      break;
    case 'warn':
      console.warn(line);
      break;
    case 'error':
      console.error(line);
      break;
    case 'info':
      console.info(line);
      break;
    case 'debug':
      console.debug(line);
      break;
  }
};

const createStyles = (palette: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: palette.background },
    webview: { flex: 1, backgroundColor: palette.background },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.background,
    },
    error: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      padding: spacing.xl,
      backgroundColor: palette.background,
    },
    errorTitle: { ...typeScale.h3, color: palette.textPrimary, textAlign: 'center' },
    errorMessage: {
      ...typeScale.body,
      color: palette.textMuted,
      textAlign: 'center',
    },
    retry: {
      marginTop: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      borderRadius: radius.md,
      backgroundColor: palette.accent,
      minHeight: 48,
      minWidth: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    retryText: { ...typeScale.body, color: palette.accentForeground },
  });

// Hosts the editor-island WebView and serves the postMessage bridge it depends
// on. The island is a pure client of the SAME `window.colanode` / `window.eventBus`
// contract the native tree uses (installed by install-shim), so the host just
// relays: island query/mutation calls -> the in-process mediator, and every
// native eventBus event -> the island (that feed is how live-query subscriptions
// refresh across the bridge). Exposes `sendCommand` so the native toolbar can
// drive the TipTap editor inside the WebView.
export const IslandHost = forwardRef<IslandHostHandle, IslandHostProps>(
  ({ node, onSaved }, ref) => {
    const { workspace } = useCurrentWorkspace();
    const { palette, isDark } = useTheme();
    const styles = useMemo(() => createStyles(palette), [palette]);

    const webViewRef = useRef<WebView>(null);
    const editorReadyRef = useRef(false);

    const [uri, setUri] = useState<string | null>(null);
    const [baseDir, setBaseDir] = useState<string | null>(null);
    const [editorReady, setEditorReady] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [timedOut, setTimedOut] = useState(false);
    // Bumped on retry to force a fresh WebView instance (and a fresh island).
    const [sessionKey, setSessionKey] = useState(0);

    const postMessage = useCallback((message: NativeToIslandMessage) => {
      webViewRef.current?.postMessage(superjson.stringify(message));
    }, []);

    // Load the single-file bundle from the asset pipeline once.
    useEffect(() => {
      let cancelled = false;
      (async () => {
        const asset = Asset.fromModule(editorHtmlAsset);
        await asset.downloadAsync();
        const localUri = asset.localUri ?? asset.uri;
        if (cancelled) {
          return;
        }
        setUri(localUri);
        setBaseDir(localUri.replace(/index\.html$/, ''));
      })();
      return () => {
        cancelled = true;
      };
    }, []);

    // Relay every native eventBus event into the island; its live queries refresh
    // off this feed (the bridge's `query_and_subscribe` only returns the first
    // page — updates arrive as events).
    useEffect(() => {
      const id = eventBus.subscribe((event) => {
        postMessage({ type: 'event', event });
      });
      return () => eventBus.unsubscribe(id);
    }, [postMessage]);

    // Start the editor-ready watchdog per WebView session.
    useEffect(() => {
      if (!uri) {
        return;
      }
      editorReadyRef.current = false;
      const timer = setTimeout(() => {
        if (!editorReadyRef.current) {
          setTimedOut(true);
        }
      }, EDITOR_READY_TIMEOUT_MS);
      return () => clearTimeout(timer);
    }, [uri, sessionKey]);

    const handleMessage = useCallback(
      async (e: WebViewMessageEvent) => {
        let message: IslandToNativeMessage;
        try {
          message = superjson.parse<IslandToNativeMessage>(e.nativeEvent.data);
        } catch (error) {
          console.error('[Island] unparseable bridge message dropped', error);
          return;
        }

        switch (message.type) {
          case 'init':
            postMessage({
              type: 'init_result',
              userId: workspace.userId,
              accountId: workspace.accountId,
              workspaceId: workspace.workspaceId,
              role: workspace.role,
              node,
              theme: isDark ? 'dark' : 'light',
            });
            break;
          case 'mutation': {
            if (!ALLOWED_MUTATIONS.has(message.input.type)) {
              console.warn('[Island] blocked mutation', message.input.type);
              postMessage({
                type: 'mutation_result',
                mutationId: message.mutationId,
                result: {
                  success: false,
                  error: {
                    code: MutationErrorCode.Unknown,
                    message: `${message.input.type} is not available in the editor.`,
                  },
                },
              });
              break;
            }
            const result = await window.colanode.executeMutation(message.input);
            postMessage({
              type: 'mutation_result',
              mutationId: message.mutationId,
              result,
            });
            break;
          }
          case 'query': {
            const result = await window.colanode.executeQuery(message.input);
            postMessage({
              type: 'query_result',
              queryId: message.queryId,
              result,
            });
            break;
          }
          case 'query_and_subscribe': {
            const result = await window.colanode.executeQueryAndSubscribe(
              message.key,
              message.input
            );
            postMessage({
              type: 'query_and_subscribe_result',
              queryId: message.queryId,
              key: message.key,
              result,
            });
            break;
          }
          case 'query_unsubscribe':
            await window.colanode.unsubscribeQuery(message.key);
            break;
          case 'console':
            logIsland(message.level, message.message);
            break;
          case 'content_saved':
            onSaved();
            break;
          case 'editor_ready':
            editorReadyRef.current = true;
            setEditorReady(true);
            break;
        }
      },
      [workspace, node, isDark, onSaved, postMessage]
    );

    const handleWebViewError = useCallback((event: WebViewErrorEvent) => {
      const { description, code } = event.nativeEvent;
      console.error('[Island] WebView failed to load', { description, code });
      setLoadError(description || 'Failed to load the editor');
    }, []);

    const handleWebViewHttpError = useCallback(
      (event: WebViewHttpErrorEvent) => {
        const { description, statusCode, url } = event.nativeEvent;
        console.error('[Island] WebView HTTP error', {
          description,
          statusCode,
          url,
        });
        setLoadError(
          description || `Failed to load the editor (HTTP ${statusCode})`
        );
      },
      []
    );

    // The island must never navigate away from its bundled file: it renders
    // collaborator-authored content while holding local-file access and the
    // data bridge, so a content link navigating the WebView would be an
    // exfiltration primitive. Web links open in the system browser instead.
    const handleShouldStartLoad = useCallback(
      (request: ShouldStartLoadRequest): boolean => {
        const url = request.url;
        if (
          url.startsWith('about:') ||
          (uri !== null && (url === uri || url.startsWith(baseDir ?? uri)))
        ) {
          return true;
        }
        if (/^https?:\/\//i.test(url)) {
          Linking.openURL(url).catch((error) =>
            console.warn('[Island] could not open link', url, error)
          );
        } else {
          console.warn('[Island] blocked navigation to', url);
        }
        return false;
      },
      [uri, baseDir]
    );

    const retry = useCallback(() => {
      editorReadyRef.current = false;
      setEditorReady(false);
      setLoadError(null);
      setTimedOut(false);
      setSessionKey((key) => key + 1);
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        sendCommand: (command: EditorCommand) => {
          postMessage({ type: 'editor_command', command });
        },
      }),
      [postMessage]
    );

    if (!uri) {
      return (
        <View style={styles.overlay}>
          <ActivityIndicator testID="island-loading" color={palette.accent} />
        </View>
      );
    }

    if (loadError || timedOut) {
      return (
        <View testID="island-error" style={styles.error}>
          <Text style={styles.errorTitle}>Editor unavailable</Text>
          <Text style={styles.errorMessage}>
            {loadError ?? 'The editor took too long to load.'}
          </Text>
          <Pressable
            testID="island-error-retry"
            accessibilityRole="button"
            accessibilityLabel="Try again"
            style={styles.retry}
            onPress={retry}
          >
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.container}>
        <WebView
          key={sessionKey}
          testID="island-webview"
          ref={webViewRef}
          style={styles.webview}
          source={{ uri }}
          originWhitelist={['file://*', 'about:*']}
          allowFileAccess
          allowingReadAccessToURL={
            Platform.OS === 'ios' ? (baseDir ?? uri) : undefined
          }
          javaScriptEnabled
          setSupportMultipleWindows={false}
          onShouldStartLoadWithRequest={handleShouldStartLoad}
          onMessage={handleMessage}
          onError={handleWebViewError}
          onHttpError={handleWebViewHttpError}
          webviewDebuggingEnabled={
            __DEV__ || process.env.EXPO_PUBLIC_E2E === 'true'
          }
        />
        {editorReady ? null : (
          <View style={styles.overlay} pointerEvents="none">
            <ActivityIndicator testID="island-loading" color={palette.accent} />
          </View>
        )}
      </View>
    );
  }
);

IslandHost.displayName = 'IslandHost';
