import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

// Resolve workspace packages to their source so deep subpath imports
// (e.g. @colanode/client/lib/mappers) resolve via directory aliasing
// rather than the package `exports` map, matching apps/web/vite.config.js.
export default defineConfig({
  test: {
    // The bug-report feature (pinpoint widget) touches window/document
    // directly (debugContext interceptors, element capture, testing-library
    // render). Node was the implicit default here before; jsdom is a strict
    // superset for the existing node-only lib tests.
    environment: 'jsdom',
    setupFiles: ['./test/setup-dom.ts'],
  },
  resolve: {
    alias: {
      // packages/ui declares react ^19.2.4 while the workspace hoists
      // react-dom 19.1.0 at the root, so npm installs a second react copy in
      // packages/ui/node_modules (same mismatch documented in
      // apps/web/vite.config.js, which fixes it for the app bundle via
      // resolve.dedupe). Vitest's SSR module resolution doesn't collapse
      // nested per-package copies the same way dedupe does for the client
      // build, so component code under test would resolve the local react
      // while @testing-library/react (hoisted at the root) drags in the root
      // react-dom — two React instances, "Invalid hook call" (null
      // dispatcher) on render. Alias both straight to the workspace root copy
      // so source and @testing-library/react share one dispatcher.
      react: resolve(__dirname, '../../node_modules/react'),
      'react-dom': resolve(__dirname, '../../node_modules/react-dom'),
      '@colanode/core': resolve(__dirname, '../core/src'),
      '@colanode/crdt': resolve(__dirname, '../crdt/src'),
      '@colanode/client': resolve(__dirname, '../client/src'),
      '@colanode/ui': resolve(__dirname, './src'),
    },
  },
});
