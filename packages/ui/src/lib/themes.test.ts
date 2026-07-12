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
    expect(vars['--primary-hover']).toBe('#1E8F64');
    expect(vars['--primary-active']).toBe('#115C40');
    expect(vars['--destructive-foreground']).toBe('#FBFAF5');
    expect(vars['--destructive-hover']).toBe('#CB5A47');
    expect(vars['--destructive-active']).toBe('#93382A');
  });

  it('returns the Mycel dark palette', () => {
    const vars = getThemeVariables('dark');
    expect(vars['--background']).toBe('#0B120F');
    expect(vars['--primary']).toBe('#57D9A3');
    expect(vars['--primary-foreground']).toBe('#0B120F');
    expect(vars['--rail']).toBe('#080D0B');
    expect(vars['--bubble-other-border']).toBe('transparent');
    expect(vars['--border-strong']).toBe('#2E5A46');
    expect(vars['--primary-hover']).toBe('#6FE3B3');
    expect(vars['--primary-active']).toBe('#3FBF8A');
    expect(vars['--destructive-foreground']).toBe('#0B120F');
    expect(vars['--destructive-hover']).toBe('#E8907F');
    expect(vars['--destructive-active']).toBe('#C4604F');
  });

  it('keeps the shadcn hover wash neutral, not brand green', () => {
    expect(getThemeVariables('light')['--accent']).toBe('#EDECE3');
    expect(getThemeVariables('dark')['--accent']).toBe('#1A2721');
  });
});
