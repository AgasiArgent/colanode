import { describe, expect, it } from 'vitest';

import { lightPalette } from '@colanode/mobile/theme/palette';
import { markStyle } from './mark-style';

describe('markStyle', () => {
  it('maps bold+italic to family/style', () => {
    const { style } = markStyle(
      [{ type: 'bold' }, { type: 'italic' }],
      lightPalette
    );
    expect(style.fontFamily).toContain('Karla_700');
    expect(style.fontStyle).toBe('italic');
  });

  it('maps code to mono with surface background', () => {
    const { style } = markStyle([{ type: 'code' }], lightPalette);
    expect(style.fontFamily).toContain('SplineSansMono');
    expect(style.backgroundColor).toBe(lightPalette.surface);
  });

  it('extracts link href and accent color', () => {
    const { style, href } = markStyle(
      [{ type: 'link', attrs: { href: 'https://x.dev' } }],
      lightPalette
    );
    expect(href).toBe('https://x.dev');
    expect(style.color).toBe(lightPalette.accent);
  });

  it('combines strike and underline into one decoration', () => {
    const { style } = markStyle(
      [{ type: 'strike' }, { type: 'underline' }],
      lightPalette
    );
    expect(style.textDecorationLine).toBe('underline line-through');
  });

  it('returns empty style for no marks', () => {
    expect(markStyle(undefined, lightPalette)).toEqual({ style: {} });
  });
});
