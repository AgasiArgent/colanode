import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'es2022',
  sourcemap: true,
  /**
   * Workspace packages ship TypeScript source (internal-packages approach),
   * so they must be bundled. Native/npm deps (better-sqlite3, the MCP SDK)
   * stay external and resolve from node_modules at runtime.
   */
  noExternal: [/^@colanode\//],
});
