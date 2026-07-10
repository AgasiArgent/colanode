// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Kysely's FileMigrationProvider loads migration files via a runtime dynamic
// `import()`. It is a Node-only code path that the mobile client never uses
// (migrations are supplied inline via `new Migrator({ provider: { getMigrations } })`),
// but it still gets pulled into the bundle through `kysely`'s barrel export and
// Hermes cannot compile the dynamic `import()` ("Invalid expression"). Resolve
// that module to an empty stub for React Native so the bundle stays Hermes-safe.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.includes('file-migration-provider')) {
    return { type: 'empty' };
  }

  // The monorepo carries two React versions (this app: 19.1.0; packages/ui
  // declares ^19.2.x, which npm may install under packages/ui/node_modules).
  // Shared @colanode/ui hooks must resolve the SAME React instance as the
  // app, or the hooks dispatcher is null at runtime ("Cannot read properties
  // of null (reading 'useRef')"). Force every react resolution to originate
  // from the app directory — the Metro equivalent of `resolve.dedupe` in the
  // web/desktop Vite configs.
  if (moduleName === 'react' || moduleName.startsWith('react/')) {
    return context.resolveRequest(
      { ...context, originModulePath: path.join(__dirname, 'package.json') },
      moduleName,
      platform
    );
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
