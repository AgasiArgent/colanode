import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Clean up after each test (mirrors apps/web/test/setup-dom.ts).
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
