import type { Pin, PinStorage } from '@agent-native/pinpoint';

interface PinSenderDeps {
  store: PinStorage;
  submit: (pins: Pin[]) => Promise<{ success: boolean; error?: string }>;
  enrich?: (pins: Pin[]) => Promise<Pin[]>;
}

export function createPinSender({ store, submit, enrich }: PinSenderDeps) {
  const submittedIds = new Set<string>();
  return async function sendQueuedPins(): Promise<void> {
    const all = await store.list({ pageUrl: window.location.pathname });
    const fresh = all.filter((pin) => !submittedIds.has(pin.id));
    if (fresh.length === 0) return;
    const enriched = enrich ? await enrich(fresh) : fresh;
    const res = await submit(enriched);
    if (res.success) {
      fresh.forEach((pin) => submittedIds.add(pin.id));
    } else {
      console.error('[BugReportWidget] pin report failed:', res.error);
    }
  };
}
