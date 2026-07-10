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

  // The rich-text editor (TipTap / ProseMirror) is a DOM-only stack. The native
  // shell never renders it — the editor ships as a WebView island (see the M7
  // spec) that runs in its own DOM JS context. But @tiptap is still pulled into
  // the Hermes bundle transitively through @colanode/client barrels: the `lib`
  // barrel re-exports `lib/editor.ts` (which imports and USES @tiptap/pm's
  // NodeSelection/TextSelection/TableMap/EditorView at runtime), and the `types`
  // barrel re-exports `types/editor.ts`. ProseMirror's model/tables code reads
  // `document` / element `.style` at module top-level, which is undefined on
  // Hermes and throws before React mounts ("Cannot read property 'style' of
  // undefined"). None of these editor code paths are reachable in the native
  // shell, so resolve the whole editor stack to an empty stub for React Native —
  // same rationale as the kysely file-migration-provider stub above. Types are
  // unaffected (tsc still resolves @tiptap from node_modules); only the runtime
  // bundle is stubbed.
  // shortcut: whole-namespace stub, correct while the native app renders no
  // editor — when the M7 editor WebView island needs @tiptap on the native side,
  // narrow this to the specific DOM-touching prosemirror modules instead.
  if (
    moduleName.startsWith('@tiptap/') ||
    moduleName.startsWith('prosemirror-')
  ) {
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
