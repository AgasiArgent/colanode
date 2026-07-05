import type { Pin } from '@agent-native/pinpoint';

import type { PinSnapshot } from '@colanode/client/mutations';

export function toPinSnapshot(pin: Pin): PinSnapshot {
  return {
    comment: pin.comment ?? '',
    sourceFile: pin.framework?.sourceFile ?? null,
    componentPath: pin.framework?.componentPath ?? null,
    selector: pin.element?.selector ?? '',
  };
}

export function buildPinSnapshots(pins: Pin[]): PinSnapshot[] {
  return pins.map(toPinSnapshot);
}
