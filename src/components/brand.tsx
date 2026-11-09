// The Xpense mark: an X of four slim leaves drawn in ink. The "/" diagonal is needs (solid ink), the "\"
// diagonal is wants (hatched). Geometry matches scripts/brand/mark.mjs (which renders the app
// icon); keep them in sync.
import { useId } from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, G, Line, Path, Pattern } from 'react-native-svg';

import { colors, fonts } from '@/theme/tokens';

const G_ = { r0: 14, R: 400, w: 86 };
const LEN = G_.R - G_.r0;
const LEAF = `M ${G_.r0} 0 C ${G_.r0 + LEN * 0.18} ${-G_.w * 0.95} ${G_.r0 + LEN * 0.62} ${-G_.w * 1.02} ${G_.R} 0 C ${
  G_.r0 + LEN * 0.62
} ${G_.w * 1.02} ${G_.r0 + LEN * 0.18} ${G_.w * 0.95} ${G_.r0} 0 Z`;
const NEED_ANGLES = [-45, 135];
const WANT_ANGLES = [-135, 45];
// The mark's content box on its 1024 canvas.
const BOX = 566;

export function LogoMark({ size = 32, ink = colors.ink, paper = colors.paper }: { size?: number; ink?: string; paper?: string }) {
  const id = `lh${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const unit = size / BOX; // pixels per mark unit
  // Hatching ~4.5 px apart at any size; below 48 px the wants leaves are drawn as outlines instead.
  const hatched = size >= 48;
  const gap = 4.5 / unit;
  const outline = 1.6 / unit;
  const leaf = (angle: number, want: boolean) => (
    <G key={angle} transform={`translate(512 512) rotate(${angle})`}>
      <Path d={LEAF} fill={want ? (hatched ? `url(#${id})` : paper) : ink} stroke={want ? ink : 'none'} strokeWidth={want ? outline : 0} />
    </G>
  );
  // Decorative: the wrapping View hides it from screen readers (Svg passes unknown props to the DOM on web).
  return (
    <View aria-hidden style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="229 229 566 566">
        {hatched && (
          <Defs>
            <Pattern id={id} patternUnits="userSpaceOnUse" width={gap} height={gap} patternTransform="rotate(45)">
              <Line x1={gap / 2} y1={0} x2={gap / 2} y2={gap} stroke={ink} strokeWidth={gap * 0.26} />
            </Pattern>
          </Defs>
        )}
        {NEED_ANGLES.map((a) => leaf(a, false))}
        {WANT_ANGLES.map((a) => leaf(a, true))}
      </Svg>
    </View>
  );
}

/** Mark + "xpense" wordmark in Instrument Serif italic (the only serif in the app). Pass mark={false} for the wordmark alone. */
export function Logo({ size = 28, mark = true, color = colors.ink }: { size?: number; mark?: boolean; color?: string }) {
  const fontSize = size * 1.18;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.36 }} accessible accessibilityRole="header" accessibilityLabel="Xpense">
      {mark && <LogoMark size={size} ink={color} />}
      <Text style={{ fontFamily: fonts.wordmark, fontSize, lineHeight: fontSize * 1.1, color }}>xpense</Text>
    </View>
  );
}

/** The app icon as a component: the ink X on a paper tile, for onboarding, the paywall and the lock screen. */
export function AppIcon({ size = 88, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size * 0.2237,
          backgroundColor: colors.paper,
          borderWidth: 1,
          borderColor: colors.rule,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}>
      <LogoMark size={size * 0.65} />
    </View>
  );
}
