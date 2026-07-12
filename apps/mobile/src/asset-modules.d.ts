// Ambient declarations for non-code assets imported through Metro's asset
// pipeline: the emoji/icon SQLite databases (src/lib/assets.ts) and the bundled
// editor-island HTML entry (src/lib/assets.ts, consumed by the WebView host).
// Metro resolves each import to an opaque numeric asset module id consumed by
// expo-asset's `Asset.fromModule`. tsc has no built-in knowledge of these
// extensions (expo/types only declares CSS modules), so the `compile` gate
// needs these declarations to typecheck the asset imports.
declare module '*.db' {
  const asset: number;
  export default asset;
}

declare module '*.html' {
  const asset: number;
  export default asset;
}
