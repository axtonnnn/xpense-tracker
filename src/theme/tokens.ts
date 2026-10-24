import { Platform, useColorScheme, type TextStyle, type ViewStyle } from 'react-native';

// Xpense theme — "safe, calm, conserving". Evergreen for trust, parchment for calm, amber for wants
// (caution, not alarm), sky blue for income, and a muted red used only when over budget.
// need / want / income are the chart series; they passed the dataviz palette validator (lightness band,
// chroma floor, colorblind separation, 3:1 contrast) against `surface` in each mode. Every text pair
// below meets WCAG AA (4.5:1) on the background it is used on.
export const palette = {
  light: {
    bg: '#F6F4EE',
    surface: '#FFFFFF',
    surfaceAlt: '#EEEBE2',
    border: '#E2DED3',
    ink: '#1B2421',
    inkMuted: '#5D6864',
    primary: '#1E5B4F',
    primarySoft: '#E3EEE9',
    onPrimary: '#FFFFFF',
    need: '#008A6E',
    needSoft: '#DDF0E9',
    needInk: '#006B55',
    want: '#B06F12',
    wantSoft: '#F6E9D3',
    wantInk: '#8A560C',
    income: '#2F6BC4',
    incomeSoft: '#E1EAF7',
    positive: '#1D7A55',
    danger: '#B53F36',
    dangerSoft: '#F8E3E0',
    pro: '#8A6212',
    gridline: '#E6E2D8',
    // Hero cards and the paywall header share the app icon's evergreen gradient.
    heroTop: '#1A5A4D',
    heroBottom: '#123F36',
    onHero: '#F6F4EE',
    onHeroMuted: '#CFE3DB',
    mint: '#8FD3B6',
    gold: '#F0BE5C',
    shadow: '#1B2421',
  },
  dark: {
    bg: '#0F1A17',
    surface: '#16231F',
    surfaceAlt: '#1E2E29',
    border: '#2A3A35',
    ink: '#E9EFEC',
    inkMuted: '#9AABA5',
    primary: '#55AE95',
    primarySoft: '#1D3A33',
    onPrimary: '#0F1A17',
    need: '#1A9878',
    needSoft: '#173A31',
    needInk: '#6CCFAE',
    want: '#C4862A',
    wantSoft: '#3A2E19',
    wantInk: '#E8B866',
    income: '#5A86DA',
    incomeSoft: '#1C2B45',
    positive: '#5FC08A',
    danger: '#E06A5F',
    dangerSoft: '#3A1F1C',
    pro: '#E2B65A',
    gridline: '#24342F',
    heroTop: '#1A4F44',
    heroBottom: '#0E2D27',
    onHero: '#F6F4EE',
    onHeroMuted: '#CFE3DB',
    mint: '#8FD3B6',
    gold: '#F0BE5C',
    shadow: '#000000',
  },
} as const;

export type Colors = { [K in keyof (typeof palette)['light']]: string };

export function useColors(): Colors {
  return palette[useColorScheme() === 'dark' ? 'dark' : 'light'];
}

export function useIsDark(): boolean {
  return useColorScheme() === 'dark';
}

// Manrope, loaded in src/app/_layout.tsx. Each weight is its own family, so never set fontWeight with it
// (Android falls back to the system font when a custom family gets a weight it doesn't have).
export const fonts = {
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
} as const;
export type Weight = keyof typeof fonts;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 12, md: 18, lg: 24, pill: 999 } as const;

export const type = {
  // One hero number per screen; proportional figures, same family as everything else.
  hero: { fontFamily: fonts.extrabold, fontSize: 44, lineHeight: 50, letterSpacing: -1.2 },
  display: { fontFamily: fonts.extrabold, fontSize: 28, lineHeight: 34, letterSpacing: -0.6 },
  title: { fontFamily: fonts.bold, fontSize: 19, lineHeight: 25, letterSpacing: -0.2 },
  body: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 22 },
  caption: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 16, letterSpacing: 0.7, textTransform: 'uppercase' },
} satisfies Record<string, TextStyle>;

/** Soft, low shadow for cards in light mode; dark mode uses a hairline border instead. */
export function elevation(isDark: boolean, level: 1 | 2 = 1): ViewStyle {
  if (isDark) return {};
  return Platform.select<ViewStyle>({
    web: { boxShadow: level === 1 ? '0 4px 16px rgba(27,36,33,0.06)' : '0 10px 30px rgba(27,36,33,0.10)' },
    default: {
      shadowColor: palette.light.shadow,
      shadowOpacity: level === 1 ? 0.06 : 0.1,
      shadowRadius: level === 1 ? 12 : 22,
      shadowOffset: { width: 0, height: level === 1 ? 4 : 10 },
      elevation: level === 1 ? 2 : 6,
    },
  });
}
