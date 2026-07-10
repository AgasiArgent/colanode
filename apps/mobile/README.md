# Colanode Mobile

> **Status:** Experimental – work in progress  
> The Colanode mobile app is under active development and **not ready for production use**.  
> It is included in this repository to make it easier to test, iterate, and contribute to its development.

## Architecture

The app is a native React Native UI over the shared `@colanode/client` data
layer. The `window.colanode` contract (defined in `@colanode/ui/window`) is
fulfilled in-process by `src/data/install-shim.ts` — the same `AppService`
mediator the web and desktop apps use, called directly on Hermes instead of
through a bridge. The UI reuses the DOM-free hooks from `@colanode/ui`
(`hooks/*`, `lib/query`, `window`) and never its DOM components.
