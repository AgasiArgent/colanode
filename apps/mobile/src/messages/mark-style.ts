import type { TextStyle } from 'react-native';

import { type Palette } from '@colanode/mobile/theme/palette';
import { fonts } from '@colanode/mobile/theme/typography';

interface Mark {
  type: string;
  attrs?: Record<string, unknown> | null;
}

// Maps ProseMirror marks on a text leaf to RN Text styling. Pure — unit-tested.
export const markStyle = (
  marks: Mark[] | null | undefined,
  palette: Palette
): { style: TextStyle; href?: string } => {
  const style: TextStyle = {};
  let href: string | undefined;
  let underline = false;
  let strike = false;

  for (const mark of marks ?? []) {
    switch (mark.type) {
      case 'bold':
        style.fontFamily = style.fontStyle === 'italic' ? fonts.bodyBold : fonts.bodyBold;
        break;
      case 'italic':
        style.fontStyle = 'italic';
        break;
      case 'underline':
        underline = true;
        break;
      case 'strike':
        strike = true;
        break;
      case 'code':
        style.fontFamily = fonts.mono;
        style.backgroundColor = palette.surface;
        break;
      case 'link':
        href = typeof mark.attrs?.href === 'string' ? mark.attrs.href : undefined;
        style.color = palette.accent;
        underline = true;
        break;
      default:
        break;
    }
  }

  if (underline && strike) {
    style.textDecorationLine = 'underline line-through';
  } else if (underline) {
    style.textDecorationLine = 'underline';
  } else if (strike) {
    style.textDecorationLine = 'line-through';
  }

  return href ? { style, href } : { style };
};
