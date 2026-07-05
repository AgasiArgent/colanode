import type { PinStorage } from '@agent-native/pinpoint';

export interface ElementCapture {
  remember(pinId: string): void;
  elementFor(pinId: string): Element | null;
  clearAll(): void;
  dispose: () => void;
}

const OVERLAY_ID = 'pinpoint-root';

export function withElementCapture(
  inner: PinStorage,
  capture: ElementCapture
): PinStorage {
  return {
    load: (pageUrl) => inner.load(pageUrl),
    save: (pin) => {
      capture.remember(pin.id);
      return inner.save(pin);
    },
    update: (id, patch) => inner.update(id, patch),
    delete: (id) => inner.delete(id),
    list: (filter) => inner.list(filter),
    clear: (pageUrl) => {
      capture.clearAll();
      return inner.clear(pageUrl);
    },
  };
}

export function createElementCapture(doc: Document): ElementCapture {
  let picked: Element | null = null;
  const byPin = new Map<string, Element>();

  const onPick = (event: Event) => {
    const target = event.target;
    if (target instanceof Element && !target.closest(`#${OVERLAY_ID}`)) {
      picked = target;
    }
  };

  doc.addEventListener('pointerdown', onPick, true);
  doc.addEventListener('click', onPick, true);

  return {
    remember(pinId) {
      if (picked) byPin.set(pinId, picked);
    },
    elementFor(pinId) {
      return byPin.get(pinId) ?? null;
    },
    clearAll() {
      byPin.clear();
    },
    dispose() {
      doc.removeEventListener('pointerdown', onPick, true);
      doc.removeEventListener('click', onPick, true);
      byPin.clear();
    },
  };
}
