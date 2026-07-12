// Mycel type — source of truth: tokens/typography.css.
// Static font-family names must match the keys loaded via useFonts (app.tsx).
export const fonts = {
  display: 'BricolageGrotesque_800ExtraBold',
  heading: 'BricolageGrotesque_700Bold',
  body: 'Karla_400Regular',
  bodyMedium: 'Karla_500Medium',
  bodySemiBold: 'Karla_600SemiBold',
  bodyBold: 'Karla_700Bold',
  mono: 'SplineSansMono_400Regular',
  monoMedium: 'SplineSansMono_500Medium',
  monoSemiBold: 'SplineSansMono_600SemiBold',
} as const;

export interface TypeStyle {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing?: number;
}

export const typeScale: Record<
  'display' | 'h1' | 'h2' | 'h3' | 'body' | 'caption' | 'code',
  TypeStyle
> = {
  display: { fontFamily: fonts.display, fontSize: 40, lineHeight: 44, letterSpacing: -0.5 },
  h1: { fontFamily: fonts.heading, fontSize: 28, lineHeight: 34 },
  h2: { fontFamily: fonts.heading, fontSize: 22, lineHeight: 28 },
  h3: { fontFamily: fonts.heading, fontSize: 17, lineHeight: 24 },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21 },
  caption: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17 },
  code: { fontFamily: fonts.mono, fontSize: 11, lineHeight: 16 },
};

// Uppercase mono section labels ("SERVERS", "CONNECT TO YOUR SERVER").
export const labelTracking = 1.2;
