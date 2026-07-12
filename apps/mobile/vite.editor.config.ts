import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Single-file build of the editor island: the shared web TipTap `Document`
// component (packages/ui) mounted inside a minimal WebView shell that talks to
// the React Native host over a postMessage bridge. Cloned from the pre-M1
// mobile WebView build (`git show 6ec7b234^:apps/mobile/vite.config.ts`) with
// the island root/outDir and the `@tanstack/react-router` stub alias added.
export default defineConfig({
  root: resolve(__dirname, 'editor-island'),
  // The shared mobile tsconfig sets jsx: "react-native" (for the RN shell),
  // which makes esbuild emit classic React.createElement for this DOM bundle
  // and crashes the WebView with "Can't find variable: React". Force the
  // automatic JSX runtime so no global React is required.
  esbuild: { jsx: 'automatic', jsxImportSource: 'react' },
  plugins: [react(), viteSingleFile()],
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    // Force a single React copy — the monorepo has react 19.1.0 (mobile) and a
    // newer react (packages/ui); without dedupe @colanode/ui and react-dom
    // resolve different instances, the hooks dispatcher is null and the WebView
    // stays blank ("Cannot read properties of null (reading 'useRef')").
    dedupe: ['react', 'react-dom'],
    alias: [
      { find: '@colanode/mobile', replacement: resolve(__dirname, './src') },
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
      // The only router coupling reachable from `Document` is `FileBlock`'s
      // `<Link>` (via @colanode/ui/components/ui/link) plus a couple of
      // `useNavigate` call sites. Replace the whole router with a thin stub so
      // the island never pulls TanStack Router (pattern precedent: the
      // @agent-native/core stub in apps/web/vite.config.js).
      {
        find: '@tanstack/react-router',
        replacement: resolve(__dirname, 'editor-island/router-stub.tsx'),
      },
    ],
  },
  build: {
    outDir: resolve(__dirname, 'assets/editor'),
    emptyOutDir: true,
    assetsInlineLimit: 100000000, // inline every asset into the single file
    sourcemap: false,
  },
});
