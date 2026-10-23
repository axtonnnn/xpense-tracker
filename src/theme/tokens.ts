import { useColorScheme } from 'react-native';

// "Safe, calm, conserving": evergreen for trust and needs, amber for wants (caution, not alarm),
// sky blue for income, and a muted red used only when over budget.
// need / want / income are the chart series; they were run through the dataviz palette validator
// (lightness band, chroma floor, colorblind separation, 3:1 contrast) against `surface` in each mode.
export const palette = {
  light: {
    bg: '#F6F4EE',
    surface: '#FFFFFF',
    surfaceAlt: '#EEEBE2',
    border: '#E2DED3',
    ink: '#1B2421',
    inkMuted: '#5D6864',
    primary: '#1E5B4F',
    onPrimary: '#FFFFFF',
    need: '#008A6E',
    want: '#B06F12',
    income: '#2F6BC4',
    danger: '#C2463D',
    pro: '#8A6212',
    gridline: '#E6E2D8',
  },
  dark: {
    bg: '#0F1A17',
    surface: '#16231F',
    surfaceAlt: '#1E2E29',
    border: '#2A3A35',
    ink: '#E9EFEC',
    inkMuted: '#9AABA5',
    primary: '#4FA88F',
    onPrimary: '#0F1A17',
    need: '#1A9878',
    want: '#C4862A',
    income: '#5A86DA',
    danger: '#E06A5F',
    pro: '#E2B65A',
    gridline: '#24342F',
  },
} as const;

export type Colors = { [K in keyof (typeof palette)['light']]: string };

export function useColors(): Colors {
  return palette[useColorScheme() === 'dark' ? 'dark' : 'light'];
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 10, md: 16, pill: 999 } as const;

export const type = {
  hero: { fontSize: 46, fontWeight: '700', letterSpacing: -0.5 },
  display: { fontSize: 30, fontWeight: '700' },
  title: { fontSize: 20, fontWeight: '700' },
  body: { fontSize: 16, fontWeight: '500' },
  caption: { fontSize: 13, fontWeight: '500' },
} as const;
