// Mycel color tokens — source of truth: claude.ai/design project
// "Workspace brand concepts", tokens/colors.css. Dark is the PRIMARY theme.
export interface Palette {
  background: string;
  surface: string;
  surfaceElevated: string;
  sidebar: string;
  rail: string;
  border: string;
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textFaint: string;
  accent: string;
  accentActive: string;
  accentForeground: string;
  accentSoft: string;
  accentSoftForeground: string;
  spore: string;
  sporeSoft: string;
  sporeSoftForeground: string;
  success: string;
  successSoft: string;
  successSoftForeground: string;
  warning: string;
  danger: string;
  dangerActive: string;
  dangerForeground: string;
  bubbleOwn: string;
  bubbleOwnForeground: string;
  bubbleOther: string;
  bubbleOtherForeground: string;
  bubbleOtherBorder: string;
  focusRing: string;
}

export const lightPalette: Palette = {
  background: '#F2F1EA',
  surface: '#FBFAF5',
  surfaceElevated: '#FFFFFF',
  sidebar: '#EDECE3',
  rail: '#E7E5DC',
  border: '#E0DED4',
  borderStrong: '#B9C4BC',
  textPrimary: '#1C2420',
  textSecondary: '#3A463F',
  textMuted: '#5C6B62',
  textFaint: '#8A968E',
  accent: '#177A55',
  accentActive: '#115C40',
  accentForeground: '#FBFAF5',
  accentSoft: '#DDEBE1',
  accentSoftForeground: '#14352A',
  spore: '#A96B1B',
  sporeSoft: '#EFE0C6',
  sporeSoftForeground: '#5A431E',
  success: '#1E7A3E',
  successSoft: '#CFE4D6',
  successSoftForeground: '#14532E',
  warning: '#A96B1B',
  danger: '#B94A38',
  dangerActive: '#93382A',
  dangerForeground: '#FBFAF5',
  bubbleOwn: '#E2EDE2',
  bubbleOwnForeground: '#1C2420',
  bubbleOther: '#FBFAF5',
  bubbleOtherForeground: '#1C2420',
  bubbleOtherBorder: '#E0DED4',
  focusRing: 'rgba(23, 122, 85, 0.15)',
};

export const darkPalette: Palette = {
  background: '#0B120F',
  surface: '#121B16',
  surfaceElevated: '#1A2721',
  sidebar: '#0E1512',
  rail: '#080D0B',
  border: '#1E2C25',
  borderStrong: '#2E5A46',
  textPrimary: '#E6EFE9',
  textSecondary: '#C8D6CD',
  textMuted: '#8FA69A',
  textFaint: '#5F7268',
  accent: '#57D9A3',
  accentActive: '#3FBF8A',
  accentForeground: '#0B120F',
  accentSoft: '#1E3B2F',
  accentSoftForeground: '#A8EACB',
  spore: '#D9A05B',
  sporeSoft: '#2E2A1A',
  sporeSoftForeground: '#E4D3B9',
  success: '#6FD98F',
  successSoft: '#1E3B2F',
  successSoftForeground: '#A8EACB',
  warning: '#D9A05B',
  danger: '#E07A6B',
  dangerActive: '#C4604F',
  dangerForeground: '#0B120F',
  bubbleOwn: '#1E3B2F',
  bubbleOwnForeground: '#E6EFE9',
  bubbleOther: '#121B16',
  bubbleOtherForeground: '#C8D6CD',
  bubbleOtherBorder: 'transparent',
  focusRing: 'rgba(87, 217, 163, 0.15)',
};
