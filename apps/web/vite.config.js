import { resolve } from 'node:path';

import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: true,
    allowedHosts: ['.ts.net'],
  },
  build: {
    // Ships prod source maps so bippy can symbolicate component file:line in
    // production builds for the pinpoint bug-report widget (Phase 1 decision:
    // approved despite the extra prod asset size).
    sourcemap: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup-dom.ts'],
  },
  resolve: {
    // packages/ui declares react ^19.2.4 while the workspace hoists react-dom
    // 19.1.0 at the root, so npm installs a second react (packages/ui/node_modules).
    // Without dedupe the bundle ends up with two React instances and the shared
    // dispatcher is null on render → "Cannot read properties of null (reading
    // 'useRef')" crashes the whole app. Force a single react/react-dom copy.
    dedupe: ['react', 'react-dom'],
    alias: [
      { find: '@colanode/web', replacement: resolve(__dirname, './src') },
      {
        find: '@colanode/core',
        replacement: resolve(__dirname, '../../packages/core/src'),
      },
      {
        find: '@colanode/crdt',
        replacement: resolve(__dirname, '../../packages/crdt/src'),
      },
      {
        find: '@colanode/client',
        replacement: resolve(__dirname, '../../packages/client/src'),
      },
      {
        find: '@colanode/ui',
        replacement: resolve(__dirname, '../../packages/ui/src'),
      },
      // @agent-native/pinpoint lazily import()s @agent-native/core (and subpaths
      // like @agent-native/core/client) only on its built-in "send to agent
      // chat" path, which the bug-report feature's own sendToAgent bridge
      // replaces. A plain string alias only matches the bare specifier and
      // concatenates any subpath onto the stub file path (stub.ts/client →
      // ENOTDIR), hard-failing `vite build`. Use a regex that maps the bare
      // specifier AND any subpath to the same stub so the bundler can resolve
      // every dynamic-import target without pulling in the framework.
      {
        find: /^@agent-native\/core(\/.*)?$/,
        replacement: resolve(
          __dirname,
          '../../packages/ui/src/features/bug-report/agentNativeCoreStub.ts'
        ),
      },
    ],
  },
  optimizeDeps: {
    exclude: ['@sqlite.org/sqlite-wasm'],
  },
  plugins: [
    viteReact(),
    VitePWA({
      mode: 'development',
      base: '/',
      includeAssets: ['favicon.ico'],
      devOptions: {
        enabled: true,
        type: 'module',
      },
      srcDir: 'src/workers',
      filename: 'service.ts',
      strategies: 'injectManifest',
      registerType: 'autoUpdate',
      injectManifest: {
        minify: false,
        enableWorkboxModulesLogs: true,
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10MB
      },
    }),
  ],
});
