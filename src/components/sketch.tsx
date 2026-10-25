// Hand-drawn ink for the app: sketched frames, pencil rules, hatching, need/want marks and stamps.
// The pen itself lives in shared/sketch.ts (the website draws with it too, and so does the design canvas).
import { useId, type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, Line, Path, Pattern, Rect } from 'react-native-svg';

import { framePaths, pen } from '../../shared/sketch';
import { colors, fonts } from '@/theme/tokens';

export { pen, seedOf, type Pen } from '../../shared/sketch';

// Frames are drawn on a 100 × 100 box stretched over their parent. The stroke keeps its width
// (non-scaling), and the box sits 1 unit in so the overshoot stays inside the view.
const frameCache = new Map<number, [string, string]>();
function cachedFrame(seed: number): [string, string] {
  let paths = frameCache.get(seed);
  if (!paths) {
    paths = framePaths(seed);
    frameCache.set(seed, paths);
  }
  return paths;
}

/**
 * The white page behind a sketched frame. It stops where the frame is drawn (1% in from each edge),
 * so the ink, not the paper, makes the edge.
 */
export function PageFill({ color = colors.page }: { color?: string }) {
  return <View pointerEvents="none" style={{ position: 'absolute', top: '1%', bottom: '1%', left: '1%', right: '1%', backgroundColor: color }} />;
}

/** A sketched outline over its parent: one firm ink line and a fainter second pass. */
export function SketchFrame({
  seed,
  weight = 1.3,
  twice = true,
  opacity = 1,
}: {
  seed: number;
  weight?: number;
  twice?: boolean;
  opacity?: number;
}) {
  const [a, b] = cachedFrame(seed);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity }]} aria-hidden>
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <Path d={a} stroke={colors.ink} strokeWidth={weight} strokeLinecap="round" fill="none" vectorEffect="non-scaling-stroke" />
        {twice && <Path d={b} stroke={colors.ink} strokeWidth={0.7} strokeLinecap="round" fill="none" opacity={0.4} vectorEffect="non-scaling-stroke" />}
      </Svg>
    </View>
  );
}

const ruleCache = new Map<number, string>();

/** A pencil rule across the full width, for separators and writing lines. */
export function SketchRule({
  seed = 1,
  opacity = 0.25,
  weight = 1,
  style,
}: {
  seed?: number;
  opacity?: number;
  weight?: number;
  style?: StyleProp<ViewStyle>;
}) {
  let d = ruleCache.get(seed);
  if (!d) {
    d = pen(seed).seg(0.5, 3, 99.5, 3, 0.4, 1.4);
    ruleCache.set(seed, d);
  }
  return (
    <View pointerEvents="none" style={[{ height: 6, opacity }, style]} aria-hidden>
      <Svg width="100%" height={6} viewBox="0 0 100 6" preserveAspectRatio="none">
        <Path d={d} stroke={colors.ink} strokeWidth={weight} strokeLinecap="round" fill="none" vectorEffect="non-scaling-stroke" />
      </Svg>
    </View>
  );
}

/** The quick underline under the selected tab or period. */
export function Scribble({ width, style }: { width: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View pointerEvents="none" style={[{ width: width + 8, height: 8, marginLeft: -4 }, style]} aria-hidden>
      <Svg width={width + 8} height={8} viewBox="0 0 100 10" preserveAspectRatio="none">
        <Path d="M2 6 C 30 3, 60 7, 98 4" stroke={colors.ink} strokeWidth={1.6} strokeLinecap="round" fill="none" vectorEffect="non-scaling-stroke" />
      </Svg>
    </View>
  );
}

/** Pencil hatching (diagonal lines 4 px apart) filling its parent. Wants are drawn with it. */
export function Hatch({ color = colors.ink, gap = 4 }: { color?: string; gap?: number }) {
  // useId returns ":r0:"-style ids, which aren't valid inside url(#…) everywhere.
  const id = `h${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} aria-hidden>
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id={id} patternUnits="userSpaceOnUse" width={gap} height={gap} patternTransform="rotate(45)">
            <Line x1={gap / 2} y1={0} x2={gap / 2} y2={gap} stroke={color} strokeWidth={1} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/** Needs: a small solid ink square. */
export function NeedMark({ size = 12 }: { size?: number }) {
  return <View style={{ width: size, height: size, backgroundColor: colors.ink, borderRadius: 1 }} />;
}

/** Wants: a small hatched square with an ink edge. */
export function WantMark({ size = 12 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: 1, borderWidth: 1.2, borderColor: colors.ink, overflow: 'hidden' }}>
      <Hatch />
    </View>
  );
}

/** Income: an open ring. */
export function IncomeMark({ size = 12 }: { size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 1.3, borderColor: colors.ink }} />;
}

/** One entry's split at a glance: solid for its needs part, hatched for its wants part. */
export function SplitMark({ need, want, size = 14 }: { need: number; want: number; size?: number }) {
  const total = need + want;
  const share = total > 0 ? need / total : 0;
  return (
    <View
      style={{ width: size, height: size, borderRadius: 1, borderWidth: 1.2, borderColor: colors.ink, overflow: 'hidden', flexDirection: 'row' }}>
      <View style={{ flex: share, backgroundColor: colors.ink }} />
      <View style={{ flex: 1 - share }}>{share < 1 && <Hatch />}</View>
    </View>
  );
}

/** A bar split into a solid needs part and a hatched wants part. */
export function SplitBar({ need, want, height = 8, style }: { need: number; want: number; height?: number; style?: StyleProp<ViewStyle> }) {
  const total = need + want;
  if (total <= 0) return null;
  return (
    <View style={[{ flexDirection: 'row', height }, style]}>
      {need > 0 && <View style={{ flex: need, backgroundColor: colors.ink }} />}
      {want > 0 && (
        <View style={{ flex: want, borderWidth: 1, borderColor: colors.ink, overflow: 'hidden' }}>
          <Hatch />
        </View>
      )}
    </View>
  );
}

/** A rubber stamp for status ("on track", "sleep on it"): a tilted inked box with handwriting. */
export function Stamp({ label, tilt = -5, style }: { label: string; tilt?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[
        { borderWidth: 1.4, borderColor: colors.ink, borderRadius: 3, paddingHorizontal: 10, paddingVertical: 1, transform: [{ rotate: `${tilt}deg` }], alignSelf: 'flex-start' },
        style,
      ]}>
      <Text style={{ fontFamily: fonts.hand, fontSize: 21, lineHeight: 25, color: colors.ink }}>{label}</Text>
    </View>
  );
}

const circleCache = new Map<string, string>();

/** A hand-drawn ring, e.g. around the account initial or a code digit. */
export function SketchCircle({ size, seed = 1, children, weight = 1.3 }: { size: number; seed?: number; children?: ReactNode; weight?: number }) {
  const key = `${size}:${seed}`;
  let d = circleCache.get(key);
  if (!d) {
    d = pen(seed).circle(size / 2, size / 2, size / 2 - 2);
    circleCache.set(key, d);
  }
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill} aria-hidden>
        <Svg width={size} height={size}>
          <Path d={d} stroke={colors.ink} strokeWidth={weight} strokeLinecap="round" fill="none" />
        </Svg>
      </View>
      {children}
    </View>
  );
}
