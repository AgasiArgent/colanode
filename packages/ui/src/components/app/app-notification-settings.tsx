import { useEffect, useState } from 'react';

import { Checkbox } from '@colanode/ui/components/ui/checkbox';
import { Separator } from '@colanode/ui/components/ui/separator';
import { useApp } from '@colanode/ui/contexts/app';
import { useServer } from '@colanode/ui/contexts/server';
import { useWorkspace } from '@colanode/ui/contexts/workspace';
import { WebPushState } from '@colanode/ui/window';

export const AppNotificationSettings = () => {
  const app = useApp();
  const workspace = useWorkspace();
  const server = useServer();
  const [state, setState] = useState<WebPushState | 'loading'>('loading');

  useEffect(() => {
    if (app.type !== 'web') {
      return;
    }

    window.colanode.push.getState().then(setState);
  }, [app.type]);

  // Web push is a PWA/browser capability — desktop and mobile have no
  // equivalent yet, so the toggle only renders in the web app.
  if (app.type !== 'web') {
    return null;
  }

  const serverPush = server.attributes.push;

  const onToggle = async (checked: boolean) => {
    if (checked) {
      if (!serverPush?.enabled || !serverPush.publicKey) {
        return;
      }

      const ok = await window.colanode.push.enable(
        workspace.userId,
        serverPush.publicKey
      );
      setState(ok ? 'enabled' : 'denied');
    } else {
      await window.colanode.push.disable(workspace.userId);
      setState('disabled');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Notifications
        </h2>
        <Separator className="mt-3" />
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {state === 'unsupported'
            ? 'Add this app to your Home Screen to enable notifications.'
            : state === 'denied'
              ? 'Notifications are blocked in your browser settings.'
              : 'Push notifications on this device.'}
        </div>
        <Checkbox
          aria-label="Enable push notifications"
          checked={state === 'enabled'}
          disabled={
            state === 'unsupported' ||
            state === 'denied' ||
            state === 'loading' ||
            !serverPush?.enabled
          }
          onCheckedChange={(checked) => {
            if (typeof checked === 'boolean') {
              void onToggle(checked);
            }
          }}
        />
      </div>
    </div>
  );
};
