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
      // The @tiptap/extension-strike mark is named `strike` (verified via
      // editor.isActive('strike')); `strikethrough` is accepted as an alias so
      // either naming renders correctly.
      case 'strike':
      case 'strikethrough':
        strike = true;
        break;
      case 'color': {
        // Pass-through: the color mark stores a color value in attrs.color
        // (web maps it to a Tailwind text class). Applied directly to RN color.
        const color = mark.attrs?.color;
        if (typeof color === 'string') {
          style.color = color;
        }
        break;
      }
      case 'highlight': {
        // Pass-through: the highlight mark stores its value in attrs.highlight
        // (web maps it to a Tailwind bg class). Applied directly to RN bg.
        const highlight = mark.attrs?.highlight;
        if (typeof highlight === 'string') {
          style.backgroundColor = highlight;
        }
        break;
      }
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
