import { useWindowDimensions, type TextStyle } from 'react-native';

// Xpense is a gallery: bone paper, white pages, black ink, square corners, and type that does the work.
// Money is drawn without colour: needs are solid ink, wants are hatched, income is an open ring, savings
// are stone. Alert red is only for errors and deleting. Every text pair meets WCAG AA on paper and page.
export const colors = {
  paper: '#F4F3EF',
  page: '#FFFFFF',
  ink: '#111111',
  /** Quiet text. 4.9:1 on paper. */
  grey: '#6B6A66',
  /** Lines between sections, chip and field outlines. */
  rule: '#D9D7D0',
  /** Lines between rows. */
  line: '#E4E2DC',
  /** Savings and money set aside. */
  stone: '#CFCCC4',
  /** The selected column behind a chart bar. */
  band: '#ECEAE4',
  alert: '#8C2F25',
  scrim: 'rgba(17,17,17,0.32)',
  onInk: '#FFFFFF',
} as const;

export type Colors = typeof colors;

// Loaded in src/app/_layout.tsx. Each weight is its own family, so never set fontWeight with them
// (Android falls back to the system font when a custom family gets a weight it doesn't have).
export const fonts = {
  extralight: 'Geist_200ExtraLight',
  light: 'Geist_300Light',
  regular: 'Geist_400Regular',
  medium: 'Geist_500Medium',
  mono: 'GeistMono_400Regular',
  monoMedium: 'GeistMono_500Medium',
  /** Only for the "xpense" wordmark. */
  wordmark: 'InstrumentSerif_400Regular_Italic',
} as const;
export type Font = keyof typeof fonts;

/** Spacing steps. Phone screens have 24 margins; sections sit 40 apart with a rule between. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, section: 40 } as const;

// Letter spacing is in points here (CSS em × size).
export const type = {
  /** One per screen: safe to spend, a scanned total. */
  hero: { fontFamily: fonts.extralight, fontSize: 96, lineHeight: 96, letterSpacing: -4.8 },
  display: { fontFamily: fonts.light, fontSize: 60, lineHeight: 60, letterSpacing: -2.7 },
  headline: { fontFamily: fonts.light, fontSize: 40, lineHeight: 44, letterSpacing: -1.4 },
  title: { fontFamily: fonts.regular, fontSize: 22, lineHeight: 28, letterSpacing: -0.44 },
  lead: { fontFamily: fonts.light, fontSize: 22, lineHeight: 30, letterSpacing: -0.44 },
  number: { fontFamily: fonts.light, fontSize: 26, lineHeight: 32, letterSpacing: -0.78 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  small: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16 },
  tab: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 14 },
  /** Figures in lists. */
  mono: { fontFamily: fonts.mono, fontSize: 14, lineHeight: 20 },
  /** Figures in legends. */
  monoSmall: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 16 },
  /** Section numbers: 01, 02… */
  index: { fontFamily: fonts.mono, fontSize: 11, lineHeight: 16 },
  /** Chart labels and ticks. */
  axis: { fontFamily: fonts.mono, fontSize: 10, lineHeight: 12 },
} satisfies Record<string, TextStyle>;

/** Durations in ms. One curve for everything: fast start, soft stop. Sheets use a gentle spring. */
export const motion = {
  /** Presses. */
  quick: 120,
  /** Tabs, switches, toggles. */
  small: 180,
  /** Rows and screens coming in. */
  standard: 240,
  /** Sheets and dialogs. */
  calm: 320,
  /** Numbers and bars, first view only. */
  showy: 700,
  /** Gap between list rows fading in, and between chart columns rising. */
  rowStagger: 30,
  columnStagger: 40,
  barStagger: 60,
} as const;
/** cubic-bezier(0.2, 0, 0, 1) */
export const CURVE = [0.2, 0, 0, 1] as const;

/** iPad, Mac and big Android tablets get the sidebar and two-column layouts. */
export const WIDE_MIN = 768;
/** Forms and lists stop growing past this width so lines stay readable on big screens. */
export const READABLE_MAX = 640;
/** Phone margins, and the bigger ones beside the sidebar. */
export const MARGIN = 24;
export const WIDE_MARGIN = 40;

export function useWide(): boolean {
  return useWindowDimensions().width >= WIDE_MIN;
}
