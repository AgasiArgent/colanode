// Ambient declarations for non-code assets imported through Metro's asset
// pipeline: the emoji/icon SQLite databases (src/lib/assets.ts) and, until the
// WebView layer is removed, the bundled HTML entry and WebView fonts
// (src/ui/mobile-fonts.tsx). Metro resolves each import to an opaque numeric
// asset module id consumed by expo-asset's `Asset.fromModule`. tsc has no
// built-in knowledge of these extensions (expo/types only declares CSS
// modules), so the `compile` gate needs these declarations to typecheck the
// asset imports.
declare module '*.db' {
  const asset: number;
  export default asset;
}

declare module '*.html' {
  const asset: number;
  export default asset;
}

declare module '*.ttf' {
  const asset: number;
  export default asset;
}

declare module '*.woff2' {
  const asset: number;
  export default asset;
}
