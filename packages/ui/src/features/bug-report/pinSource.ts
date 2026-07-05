import type { Pin } from '@agent-native/pinpoint';

import type { ElementCapture } from './elementCapture';

interface ResolvedSource {
  fileName: string;
  lineNumber?: number;
}

export interface PinSourceDeps {
  findElement: (pin: Pin) => Element | null;
  getFibers: (element: Element) => unknown[];
  getSource: (fiber: unknown) => Promise<ResolvedSource | null>;
  getName: (fiber: unknown) => Promise<string | null>;
}

export function normalizeSourcePath(fileName: string): string {
  return fileName
    .replace(/^[a-z-]+:\/\/[^/]*\//i, '')
    .replace(/^\[project\]\//, '')
    .replace(/^\.\//, '');
}

function sourceRank(path: string): 0 | 1 | 2 {
  if (path.includes('node_modules')) return 2;
  if (/(^|\/)components\/ui\//.test(path)) return 1;
  return 0;
}

function isRealComponentName(name: string | null): name is string {
  return !!name && /^[A-Z][A-Za-z0-9]/.test(name);
}

export function componentNameFromPath(path: string): string | null {
  const base = path.split('/').pop()?.replace(/\.[jt]sx?$/, '');
  if (!base) return null;
  const name = base
    .split(/[-_.]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
  return name || null;
}

export async function enrichPinsWithSource(
  pins: Pin[],
  deps: PinSourceDeps
): Promise<Pin[]> {
  return Promise.all(pins.map((pin) => enrichPin(pin, deps)));
}

async function enrichPin(pin: Pin, deps: PinSourceDeps): Promise<Pin> {
  if (pin.framework?.sourceFile) return pin;

  try {
    const element = deps.findElement(pin);
    if (!element) return pin;

    const fibers = deps.getFibers(element);
    if (fibers.length === 0) return pin;

    let best: { fiber: unknown; source: ResolvedSource; rank: 0 | 1 | 2 } | null =
      null;
    for (const fiber of fibers) {
      const source = await deps.getSource(fiber);
      if (!source) continue;
      const rank = sourceRank(normalizeSourcePath(source.fileName));
      if (best === null || rank < best.rank) best = { fiber, source, rank };
      if (rank === 0) break;
    }
    return best ? applySource(pin, best.fiber, best.source, deps) : pin;
  } catch {
    return pin;
  }
}

async function applySource(
  pin: Pin,
  fiber: unknown,
  source: ResolvedSource,
  deps: PinSourceDeps
): Promise<Pin> {
  const path = normalizeSourcePath(source.fileName);
  const resolved = await deps.getName(fiber);
  const name = isRealComponentName(resolved)
    ? resolved
    : componentNameFromPath(path);
  const framework = {
    framework: 'react',
    componentPath: '',
    ...pin.framework,
  };
  framework.sourceFile = source.lineNumber
    ? `${path}:${source.lineNumber}`
    : path;
  if (name) framework.componentPath = `<${name}>`;
  return { ...pin, framework };
}

export type PinEnricher = (pins: Pin[]) => Promise<Pin[]>;

const MAX_CLIMB = 15;

export function createBippyPinEnricher(capture?: ElementCapture): PinEnricher {
  return async (pins: Pin[]) => {
    try {
      const { getFiberFromHostInstance } = await import('bippy');
      const { getSource, getDisplayNameFromSource } = await import(
        'bippy/source'
      );
      const deps: PinSourceDeps = {
        findElement: (pin) => findPinElement(pin, capture),
        getFibers: (el) => collectFibers(el, getFiberFromHostInstance),
        getSource: (fiber) => getSource(fiber as never),
        getName: (fiber) => getDisplayNameFromSource(fiber as never),
      };
      return enrichPinsWithSource(pins, deps);
    } catch {
      return pins;
    }
  };
}

function collectFibers(
  element: Element,
  getFiber: (el: Element) => { type?: unknown; return?: unknown } | null
): unknown[] {
  const host = getFiber(element);
  if (!host) return [];
  const out: unknown[] = [host];
  let current = host.return as
    | { type?: unknown; return?: unknown }
    | null
    | undefined;
  let climbed = 0;
  while (current && climbed < MAX_CLIMB) {
    if (typeof current.type !== 'string') {
      out.push(current);
      climbed++;
    }
    current = current.return as
      | { type?: unknown; return?: unknown }
      | null
      | undefined;
  }
  return out;
}

function findPinElement(pin: Pin, capture?: ElementCapture): Element | null {
  const captured = capture?.elementFor(pin.id);
  if (captured && captured.isConnected) return captured;

  for (const query of [pin.element?.domPath, pin.element?.selector]) {
    if (!query) continue;
    try {
      const el = document.querySelector(query);
      if (el) return el;
    } catch {
      // invalid selector — try the next candidate
    }
  }
  return null;
}
