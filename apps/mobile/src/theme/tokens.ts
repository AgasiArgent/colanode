// Provisional neutral tokens for the M1 shell. The real design tokens from
// the claude.ai/design pass (see docs/superpowers/specs/2026-07-09-rebrand-
// design-prompts.md) replace the values in this file — screens must never
// hardcode colors/sizes, only reference tokens.
export const tokens = {
  colors: {
    background: '#ffffff',
    surface: '#f5f5f5',
    border: '#e5e5e5',
    textPrimary: '#171717',
    textSecondary: '#525252',
    textMuted: '#a3a3a3',
    accent: '#171717',
    danger: '#dc2626',
    success: '#16a34a',
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  fontSize: { xs: 12, sm: 14, md: 16, lg: 20, xl: 24 },
  radius: { sm: 6, md: 10, lg: 16 },
} as const;
