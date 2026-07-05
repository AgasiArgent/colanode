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
  },
  resolve: {
    alias: {
      '@colanode/core': resolve(__dirname, '../core/src'),
      '@colanode/crdt': resolve(__dirname, '../crdt/src'),
      '@colanode/client': resolve(__dirname, '../client/src'),
      '@colanode/ui': resolve(__dirname, './src'),
    },
  },
});
