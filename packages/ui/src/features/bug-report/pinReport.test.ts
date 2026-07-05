import { describe, expect, it } from 'vitest';

import { buildPinSnapshots } from './pinReport';

describe('features/bug-report/pinReport', () => {
  it('flattens pins into snapshots, defaulting missing source fields to null', () => {
    const pins = [
      {
        id: '1',
        comment: 'typo here',
        element: { selector: 'nav > a:nth-child(3)' },
        framework: {
          sourceFile: 'packages/ui/src/x.tsx:97',
          componentPath: '<SidebarMenuItem>',
        },
      },
      { id: '2', comment: '', element: { selector: 'div.foo' } },
    ] as never[];

    expect(buildPinSnapshots(pins)).toEqual([
      {
        comment: 'typo here',
        sourceFile: 'packages/ui/src/x.tsx:97',
        componentPath: '<SidebarMenuItem>',
        selector: 'nav > a:nth-child(3)',
      },
      { comment: '', sourceFile: null, componentPath: null, selector: 'div.foo' },
    ]);
  });
});
