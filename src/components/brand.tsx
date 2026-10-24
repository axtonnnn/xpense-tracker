// The Xpense mark: an X of four slim leaves — needs on the "/" diagonal, wants on the "\" diagonal.
// Geometry matches scripts/brand/mark.mjs (which renders the app icon); keep them in sync.
import { LinearGradient } from 'expo-linear-gradient';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

import { fonts, useColors, useIsDark } from '@/theme/tokens';

const G_ = { r0: 14, R: 400, w: 86, rib: 14 };
const LEN = G_.R - G_.r0;
const LEAF = `M ${G_.r0} 0 C ${G_.r0 + LEN * 0.18} ${-G_.w * 0.95} ${G_.r0 + LEN * 0.62} ${-G_.w * 1.02} ${G_.R} 0 C ${
  G_.r0 + LEN * 0.62
} ${G_.w * 1.02} ${G_.r0 + LEN * 0.18} ${G_.w * 0.95} ${G_.r0} 0 Z`;
const RIB = `M ${(G_.r0 + LEN * 0.16).toFixed(1)} 0 L ${(G_.R - LEN * 0.2).toFixed(1)} 0`;
const NEED_ANGLES = [-45, 135];
const WANT_ANGLES = [-135, 45];

export const MARK_COLORS = {
  light: { need: '#0E8066', want: '#CC8418' },
  dark: { need: '#8FD3B6', want: '#F0BE5C' },
  icon: { need: '#8FD3B6', want: '#F0BE5C' },
} as const;

type Variant = 'auto' | 'light' | 'dark' | 'icon' | 'mono';

export function LogoMark({
  size = 32,
  variant = 'auto',
  color,
  ribColor,
  opacity = 1,
}: {
  size?: number;
  variant?: Variant;
  /** Single colour for the "mono" variant. */
  color?: string;
  /** Draw leaf ribs in this colour (use the colour behind the mark); best above ~64 px. */
  ribColor?: string;
  opacity?: number;
}) {
  const dark = useIsDark();
  const scheme = variant === 'auto' ? (dark ? 'dark' : 'light') : variant;
  const colors = scheme === 'mono' ? { need: color ?? '#FFFFFF', want: color ?? '#FFFFFF' } : MARK_COLORS[scheme];
  const leaf = (angle: number, fill: string) => (
    <G key={angle} transform={`translate(512 512) rotate(${angle})`}>
      <Path d={LEAF} fill={fill} />
      {ribColor ? <Path d={RIB} stroke={ribColor} strokeWidth={G_.rib} strokeLinecap="round" /> : null}
    </G>
  );
  // Decorative: the wrapping View hides it from screen readers (Svg passes unknown props to the DOM on web).
  return (
    <View aria-hidden style={{ width: size, height: size, opacity }}>
      <Svg width={size} height={size} viewBox="229 229 566 566">
        {NEED_ANGLES.map((a) => leaf(a, colors.need))}
        {WANT_ANGLES.map((a) => leaf(a, colors.want))}
      </Svg>
    </View>
  );
}

/** Mark + "xpense" wordmark. Pass mark={false} for the wordmark alone (e.g. under the app icon). */
export function Logo({ size = 28, onHero, mark = true }: { size?: number; onHero?: boolean; mark?: boolean }) {
  const c = useColors();
  const dark = useIsDark();
  const fontSize = size * 0.92;
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.28 }}
      accessible
      accessibilityRole="header"
      accessibilityLabel="Xpense">
      {mark && <LogoMark size={size} variant={onHero || dark ? 'dark' : 'light'} />}
      <Text
        style={{
          fontFamily: fonts.extrabold,
          fontSize,
          lineHeight: fontSize * 1.15,
          letterSpacing: -0.03 * fontSize,
          color: onHero ? c.onHero : dark ? c.ink : c.primary,
          marginTop: -size * 0.08,
        }}>
        xpense
      </Text>
    </View>
  );
}

/** The app icon as a component (rounded evergreen tile), for onboarding, the paywall and the lock screen. */
export function AppIcon({ size = 88, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <LinearGradient
      colors={['#23715F', '#123F36']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.3, y: 1 }}
      style={[{ width: size, height: size, borderRadius: size * 0.2237, alignItems: 'center', justifyContent: 'center' }, style]}>
      <LogoMark size={size * 0.553} variant="icon" ribColor={size >= 64 ? '#1A5747' : undefined} />
    </LinearGradient>
  );
}
