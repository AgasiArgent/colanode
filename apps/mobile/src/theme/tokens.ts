// Mycel layout constants — source of truth: tokens/spacing.css + motion.css.
// Colors live in palette.ts (theme-dependent), type in typography.ts.
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

// Organic radii — Mycel is soft, never sharp.
export const radius = {
  sm: 8,
  md: 12, // buttons, inputs, chips
  lg: 16, // cards, composer
  xl: 20, // modals
  full: 999,
  bubble: 16,
  bubbleAnchor: 4, // bubble corner pointing at the avatar
} as const;

// Surfaces GROW (scale .98 -> 1 + fade), never slide.
export const motion = {
  microDurationMs: 120,
  panelDurationMs: 240,
  sporePeriodMs: 2600, // breathing pulse while writing locally
  sporeRippleMs: 600, // single ripple on peer acknowledgement
} as const;
