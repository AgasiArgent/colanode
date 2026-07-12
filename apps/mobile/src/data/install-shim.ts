import { Linking, Platform } from 'react-native';

import { eventBus } from '@colanode/client/lib';
import type { AppService } from '@colanode/client/services';
import { generateId, IdType } from '@colanode/core';
import { createColanodeApi } from '@colanode/mobile/data/colanode-api';
import { MobilePushService } from '@colanode/mobile/services/push-service';

// Fulfills the window.colanode / window.eventBus contract that the shared
// packages/ui hooks (use-query, use-live-query, lib/query.ts) depend on.
// On Hermes `window === global`, so the web contract applies verbatim.
export const installColanodeShim = (
  app: AppService,
  pushService: MobilePushService
): void => {
  const windowId = generateId(IdType.Window);

  // shortcut: token kept in module scope only (mirrors the pre-existing
  // WebView-era behavior) — persist alongside the apns subscription when
  // push settings UX lands in M2+.
  let pushToken: string | null = null;

  window.colanode = createColanodeApi({
    mediator: app.mediator,
    windowId,
    openUrl: async (url) => {
      await Linking.openURL(url);
    },
    push: {
      enable: async (userId) => {
        const token = await pushService.enable();
        if (!token) {
          return false;
        }

        pushToken = token;
        const result = await app.mediator.executeMutation({
          type: 'apnsSubscription.create',
          userId,
          deviceToken: token,
        });
        return result.success;
      },
      disable: async (userId) => {
        if (pushToken) {
          await app.mediator.executeMutation({
            type: 'apnsSubscription.delete',
            userId,
            deviceToken: pushToken,
          });
          pushToken = null;
        }
        await pushService.disable();
      },
      getState: () => pushService.getState(),
      isSupported: () => Platform.OS === 'ios',
    },
  });

  window.eventBus = eventBus;
};
