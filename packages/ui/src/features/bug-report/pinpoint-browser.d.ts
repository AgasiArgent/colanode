// Restores mountPinpoint/MountResult types for the browser condition of
// @agent-native/pinpoint@0.1.10 (its "." types point at the server-safe
// surface even though the browser runtime ships the DOM-mount API). These ARE
// the package's documented public API (README "Standalone / Vanilla JS").
import type { PinpointConfig } from '@agent-native/pinpoint';

declare module '@agent-native/pinpoint' {
  export interface MountResult {
    dispose: () => void;
    shadowRoot: ShadowRoot;
    container: HTMLDivElement;
  }

  export function mountPinpoint(
    config?: PinpointConfig,
    target?: HTMLElement
  ): MountResult;
}
