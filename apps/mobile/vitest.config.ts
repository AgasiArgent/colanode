import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Mirror the tsconfig `paths` self-alias so tests can import local modules
    // as `@colanode/mobile/*` (vitest does not read tsconfig `paths`). The
    // package has no `exports` map, so bare-specifier resolution would miss
    // `src/`; this maps `@colanode/mobile/*` -> `./src/*` exactly like tsc.
    alias: {
      '@colanode/mobile': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
