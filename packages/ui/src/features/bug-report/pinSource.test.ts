import { describe, expect, it } from 'vitest';

import {
  componentNameFromPath,
  normalizeSourcePath,
} from './pinSource';

describe('features/bug-report/pinSource', () => {
  it('strips bundler scheme prefixes to a repo-relative path', () => {
    expect(normalizeSourcePath('webpack://host/packages/ui/src/x.tsx')).toBe(
      'packages/ui/src/x.tsx'
    );
    expect(normalizeSourcePath('[project]/apps/web/src/y.tsx')).toBe(
      'apps/web/src/y.tsx'
    );
    expect(normalizeSourcePath('./z.tsx')).toBe('z.tsx');
  });

  it('derives a PascalCase component name from a file path', () => {
    expect(componentNameFromPath('src/components/sidebar-menu.tsx')).toBe(
      'SidebarMenu'
    );
    expect(componentNameFromPath('inbox-item.tsx')).toBe('InboxItem');
  });
});
