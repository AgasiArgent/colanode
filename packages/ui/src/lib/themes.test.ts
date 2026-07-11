import { describe, expect, it } from 'vitest';

import { getThemeVariables } from '@colanode/ui/lib/themes';

describe('getThemeVariables', () => {
  it('returns the Mycel light palette', () => {
    const vars = getThemeVariables('light');
    expect(vars['--background']).toBe('#F2F1EA');
    expect(vars['--primary']).toBe('#177A55');
    expect(vars['--sidebar']).toBe('#EDECE3');
    expect(vars['--spore']).toBe('#A96B1B');
    expect(vars['--bubble-other-border']).toBe('#E0DED4');
    expect(vars['--border-strong']).toBe('#B9C4BC');
  });

  it('returns the Mycel dark palette', () => {
    const vars = getThemeVariables('dark');
    expect(vars['--background']).toBe('#0B120F');
    expect(vars['--primary']).toBe('#57D9A3');
    expect(vars['--primary-foreground']).toBe('#0B120F');
    expect(vars['--rail']).toBe('#080D0B');
    expect(vars['--bubble-other-border']).toBe('transparent');
    expect(vars['--border-strong']).toBe('#2E5A46');
  });

  it('keeps the shadcn hover wash neutral, not brand green', () => {
    expect(getThemeVariables('light')['--accent']).toBe('#EDECE3');
    expect(getThemeVariables('dark')['--accent']).toBe('#1A2721');
  });
});
