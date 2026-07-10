import { describe, expect, it } from 'vitest';

import { darkPalette, lightPalette } from './palette';

describe('mycel palettes', () => {
  it('light and dark expose identical token sets', () => {
    expect(Object.keys(darkPalette).sort()).toEqual(
      Object.keys(lightPalette).sort()
    );
  });

  it('dark is the biolum ramp (spot-check brand anchors)', () => {
    expect(darkPalette.accent).toBe('#57D9A3');
    expect(lightPalette.accent).toBe('#177A55');
    expect(darkPalette.background).toBe('#0B120F');
  });
});
