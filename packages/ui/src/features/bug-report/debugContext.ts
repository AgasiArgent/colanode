import type {
  BugReportConsoleEntry,
  BugReportDebugContext,
} from '@colanode/client/mutations';

const consoleErrors: BugReportConsoleEntry[] = [];
let interceptorsInstalled = false;

function pushError(entry: BugReportConsoleEntry) {
  consoleErrors.push(entry);
  if (consoleErrors.length > 10) consoleErrors.shift();
}

export function installErrorInterceptors() {
  if (interceptorsInstalled) return;
  interceptorsInstalled = true;

  const origError = console.error;
  console.error = (...args: unknown[]) => {
    pushError({
      type: 'error',
      message: args.map(String).join(' '),
      time: new Date().toISOString(),
    });
    origError.apply(console, args);
  };

  const origWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    pushError({
      type: 'warn',
      message: args.map(String).join(' '),
      time: new Date().toISOString(),
    });
    origWarn.apply(console, args);
  };

  window.addEventListener('error', (e) => {
    pushError({
      type: 'exception',
      message: `${e.message} at ${e.filename}:${e.lineno}`,
      time: new Date().toISOString(),
    });
  });
}

export function collectDebugContext(): BugReportDebugContext {
  return {
    url: window.location.href,
    title: document.title,
    userAgent: navigator.userAgent,
    screenSize: `${window.innerWidth}x${window.innerHeight}`,
    consoleErrors: consoleErrors.slice(-5),
    collectedAt: new Date().toISOString(),
  };
}
