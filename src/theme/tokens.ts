import { useWindowDimensions, type TextStyle } from 'react-native';

// Xpense is a pocket sketchbook: beige paper, white pages, black ink. It is always light, like paper.
// Money is drawn without colour: needs are solid ink, wants are pencil hatching, income is an open ring.
// Every text pair below meets WCAG AA (4.5:1) on the paper and page colours.
export const colors = {
  paper: '#F6F2EA',
  page: '#FFFFFF',
  sand: '#E7DFD0',
  ink: '#111111',
  graphite: '#5E5A53',
  pencil: '#716B62',
  line: 'rgba(17,17,17,0.12)',
  alert: '#8C2F25',
  alertSoft: '#F3E3DE',
  onInk: '#FFFFFF',
} as const;

export type Colors = typeof colors;

export function useColors(): Colors {
  return colors;
}

// Loaded in src/app/_layout.tsx. Each weight is its own family, so never set fontWeight with them
// (Android falls back to the system font when a custom family gets a weight it doesn't have).
export const fonts = {
  serif: 'InstrumentSerif_400Regular',
  serifItalic: 'InstrumentSerif_400Regular_Italic',
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  hand: 'Caveat_500Medium',
} as const;
export type Font = keyof typeof fonts;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
/** Ink plates are nearly square-cornered, like a cut piece of paper. */
export const radius = { plate: 2, tile: 25, pill: 999 } as const;

export const type = {
  // Serif for headings and amounts; one hero number per screen.
  hero: { fontFamily: fonts.serif, fontSize: 56, lineHeight: 60, letterSpacing: -0.5 },
  display: { fontFamily: fonts.serif, fontSize: 44, lineHeight: 48 },
  title: { fontFamily: fonts.serif, fontSize: 28, lineHeight: 32 },
  number: { fontFamily: fonts.serif, fontSize: 30, lineHeight: 34 },
  // Inter for everything you read and tap.
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23 },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 1.4, textTransform: 'uppercase' },
  // Caveat, only for short pencil notes in the margins.
  note: { fontFamily: fonts.hand, fontSize: 21, lineHeight: 23 },
} satisfies Record<string, TextStyle>;

/** iPad, Mac and big Android tablets get the sidebar and two-column layouts. */
export const WIDE_MIN = 768;
/** Forms and lists stop growing past this width so lines stay readable on big screens. */
export const READABLE_MAX = 640;

export function useWide(): boolean {
  return useWindowDimensions().width >= WIDE_MIN;
}
