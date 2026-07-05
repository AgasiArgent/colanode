import { describe, expect, it } from 'vitest';

import { buildIssueBody, buildIssueTitle } from './issue-body';

const base = {
  did: 'opened the workspace, clicked the sidebar',
  expected: 'Settings',
  got: 'Setings??',
  context: {
    url: 'https://chat.kvotaflow.ru/w/x/inbox',
    title: 'Inbox',
    userAgent: 'ua',
    screenSize: '1440x900',
    consoleErrors: [
      { type: 'error', message: "TypeError: Cannot read properties of undefined (reading 'x')", time: 't' },
    ],
    collectedAt: 'now',
  },
  reporter: { name: 'Ivan Tester' },
};

describe('lib/bug-report/issue-body', () => {
  it('renders reporter, did/expected/got, ranked pinned source, and console errors', () => {
    const body = buildIssueBody({
      ...base,
      title: 'Sidebar label typo',
      pins: [
        {
          comment: 'typo',
          sourceFile: 'packages/ui/src/components/layouts/sidebars/sidebar-menu.tsx:97',
          componentPath: '<SidebarMenuItem>',
          selector: 'nav > a:nth-child(3)',
        },
      ],
    });
    expect(body).toContain('**Reported by:** Ivan Tester (colanode) · via pinpoint widget');
    expect(body).toContain('**Page:** https://chat.kvotaflow.ru/w/x/inbox');
    expect(body).toContain('**Did:** opened the workspace, clicked the sidebar');
    expect(body).toContain('**Got:** Setings??');
    expect(body).toContain('**Pinned source (1 pins, most useful first):**');
    expect(body).toContain(
      '1. `packages/ui/src/components/layouts/sidebars/sidebar-menu.tsx:97` — `<SidebarMenuItem>` — selector `nav > a:nth-child(3)` — note: "typo"'
    );
    expect(body).toContain('**Console errors (1):**');
    expect(body).toContain('_Reported from colanode pinpoint widget._');
  });

  it('degrades gracefully when a pin has no resolved source', () => {
    const body = buildIssueBody({
      ...base,
      title: '',
      pins: [
        { comment: 'x', sourceFile: null, componentPath: null, selector: 'div.foo' },
      ],
    });
    expect(body).toContain(
      '1. _no source resolved_ — selector `div.foo` — note: "x"'
    );
  });

  it('appends a note fragment when a pin has a comment, and omits it when empty', () => {
    const body = buildIssueBody({
      ...base,
      title: '',
      pins: [
        { comment: 'reproduces every time', sourceFile: 'a.tsx:1', componentPath: null, selector: 'div.bar' },
        { comment: '', sourceFile: 'b.tsx:2', componentPath: null, selector: 'div.baz' },
      ],
    });
    expect(body).toContain('1. `a.tsx:1` — selector `div.bar` — note: "reproduces every time"');
    expect(body).toContain('2. `b.tsx:2` — selector `div.baz`');
    expect(body).not.toContain('`div.baz` — note:');
  });

  it('falls back to "<Component> — <page>" for an empty title', () => {
    const title = buildIssueTitle({
      ...base,
      title: '',
      pins: [
        { comment: 'x', sourceFile: 'a.tsx:1', componentPath: '<SidebarMenuItem>', selector: 's' },
      ],
    });
    expect(title).toBe('<SidebarMenuItem> — Inbox');
  });
});
