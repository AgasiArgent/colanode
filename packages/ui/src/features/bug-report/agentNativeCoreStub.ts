// Stub aliased in place of @agent-native/core (see apps/web/vite.config.js).
// @agent-native/pinpoint lazily import()s @agent-native/core ONLY on its
// built-in "send to agent chat" path. Our sendToAgent bridge replaces that
// path, so this module is never executed at runtime — it exists solely so the
// bundler can resolve the dynamic-import target without pulling in the whole
// agent-native framework.
//
// shortcut: stub-alias keeps the framework out of the tree for a code path we
// never run — swap for a real `npm i @agent-native/core` only if a future
// feature actually needs core.
export {};
