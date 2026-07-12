import type { MutationInput } from '@colanode/client/mutations';
import type { QueryInput } from '@colanode/client/queries';
import type { AppService } from '@colanode/client/services';
import type { ColanodeWindowApi } from '@colanode/ui/window';

type Mediator = AppService['mediator'];

export interface ColanodeApiDeps {
  mediator: Pick<
    Mediator,
    | 'executeQuery'
    | 'executeQueryAndSubscribe'
    | 'unsubscribeQuery'
    | 'executeMutation'
  >;
  windowId: string;
  openUrl: (url: string) => Promise<void>;
  push: ColanodeWindowApi['push'];
}

// In-process implementation of the ColanodeWindowApi contract
// (packages/ui/src/window.ts) — the fourth transport after the web Comlink
// worker, the Electron IPC bridge, and the removed mobile WebView bridge.
// Pure factory with zero runtime imports so it is unit-testable in node;
// RN wiring (Linking, push, global assignment) lives in install-shim.ts.
export const createColanodeApi = (deps: ColanodeApiDeps): ColanodeWindowApi => {
  const { mediator, windowId, openUrl, push } = deps;

  return {
    // Native boot renders the UI only after AppService.init() succeeded, so
    // consumers asking init() are by definition post-init.
    init: async () => 'success',
    reset: async () => {
      throw new Error('reset is not supported in the native mobile app yet');
    },
    executeMutation: <T extends MutationInput>(input: T) =>
      mediator.executeMutation(input),
    executeQuery: <T extends QueryInput>(input: T) =>
      mediator.executeQuery(input),
    executeQueryAndSubscribe: <T extends QueryInput>(key: string, input: T) =>
      mediator.executeQueryAndSubscribe(key, windowId, input),
    unsubscribeQuery: async (key: string) => {
      mediator.unsubscribeQuery(key, windowId);
    },
    saveTempFile: async () => {
      throw new Error('saveTempFile is not implemented on mobile');
    },
    openExternalUrl: (url: string) => openUrl(url),
    showItemInFolder: async () => {
      // No-op, same as web.
    },
    showFileSaveDialog: async () => undefined,
    push,
  };
};
