// Line drawings in the Gallery style: a receipt, the camera frame, an empty page. All decorative.
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { useMotion } from './motion';
import { colors } from '@/theme/tokens';

const ROWS: [number, number][] = [
  [52, 16],
  [44, 16],
  [60, 16],
  [36, 16],
  [48, 16],
  [56, 16],
  [40, 16],
];

/** A paper receipt: a heading bar, item lines with prices, a dashed rule and the total. */
export function ReceiptPicture({
  width = 112,
  height,
  rows = 4,
  dashed,
  children,
  style,
}: {
  width?: number;
  height?: number;
  rows?: number;
  /** A faint, dashed receipt: the one the camera couldn't read. */
  dashed?: boolean;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const big = width >= 160;
  const line = big ? 2 : 2;
  const pad = big ? { paddingVertical: 22, paddingHorizontal: 18 } : { paddingVertical: 14, paddingHorizontal: 12 };
  const ink = dashed ? 'transparent' : colors.ink;
  const grey = dashed ? 'transparent' : colors.grey;
  const dash = (w: DimensionValue, thick = 1) => <View style={{ width: w, borderTopWidth: thick, borderColor: colors.grey, borderStyle: 'dashed' }} />;
  return (
    <View
      aria-hidden
      style={[
        styles.receipt,
        pad,
        { width, height, gap: big ? 10 : 7 },
        dashed && { borderStyle: 'dashed', backgroundColor: 'transparent' },
        style,
      ]}>
      {dashed ? (
        <>
          <View style={{ alignSelf: 'center', width: '60%' }}>{dash('100%', 2)}</View>
          {dash('100%')}
          {dash('80%')}
          {dash('100%')}
          {dash('70%')}
          {dash('100%')}
          <View style={{ alignSelf: 'flex-end', width: '50%' }}>{dash('100%', 2)}</View>
        </>
      ) : (
        <>
          <View style={{ width: '58%', height: big ? 4 : 3, alignSelf: 'center', backgroundColor: ink }} />
          {big && <View style={{ width: '40%', height: line, alignSelf: 'center', backgroundColor: grey }} />}
          {ROWS.slice(0, rows).map(([a, b], i) => (
            <View key={i} style={[styles.spread, i === 0 && { marginTop: big ? 8 : 4 }]}>
              <View style={{ width: `${a}%`, height: line, backgroundColor: grey }} />
              <View style={{ width: `${b + 2}%`, height: line, backgroundColor: grey }} />
            </View>
          ))}
          <View style={{ marginTop: big ? 6 : 4, borderTopWidth: 1, borderColor: ink, borderStyle: 'dashed' }} />
          <View style={styles.spread}>
            <View style={{ width: '30%', height: big ? 4 : 3, backgroundColor: ink }} />
            <View style={{ width: '24%', height: big ? 4 : 3, backgroundColor: ink }} />
          </View>
        </>
      )}
      {children}
    </View>
  );
}

/** Four corner marks around whatever sits inside: the camera frame. */
export function Corners({ size = 28, inset = 20 }: { size?: number; inset?: number }) {
  const c = { position: 'absolute' as const, width: size, height: size, borderColor: colors.ink };
  return (
    <>
      <View style={[c, { left: inset, top: inset, borderLeftWidth: 1.5, borderTopWidth: 1.5 }]} />
      <View style={[c, { right: inset, top: inset, borderRightWidth: 1.5, borderTopWidth: 1.5 }]} />
      <View style={[c, { left: inset, bottom: inset, borderLeftWidth: 1.5, borderBottomWidth: 1.5 }]} />
      <View style={[c, { right: inset, bottom: inset, borderRightWidth: 1.5, borderBottomWidth: 1.5 }]} />
    </>
  );
}

/** AI mode's picture: a receipt laid flat inside the camera frame. */
export function Viewfinder() {
  return (
    <View aria-hidden style={styles.viewfinder}>
      <Corners />
      <View style={{ position: 'absolute', top: 32, bottom: 32, left: 0, right: 0, alignItems: 'center' }}>
        <ReceiptPicture width={112} height={156} />
      </View>
    </View>
  );
}

/** The receipt being read: a line sweeps down and back while the AI works. Still with Reduce Motion. */
export function ReadingReceipt() {
  const moving = useMotion();
  const p = useSharedValue(0.42);
  useEffect(() => {
    if (!moving) return;
    p.set(0.08);
    p.set(withRepeat(
      withSequence(withTiming(0.88, { duration: 800, easing: Easing.inOut(Easing.quad) }), withTiming(0.08, { duration: 800, easing: Easing.inOut(Easing.quad) })),
      -1,
    ));
  }, [moving, p]);
  const H = 260;
  const line = useAnimatedStyle(() => ({ transform: [{ translateY: p.value * H }] }));
  const shade = useAnimatedStyle(() => ({ height: p.value * H }));
  return (
    <View aria-hidden style={{ alignSelf: 'center' }}>
      <ReceiptPicture width={188} height={H} rows={7}>
        <Animated.View style={[styles.shade, shade]} />
      </ReceiptPicture>
      <Animated.View style={[styles.sweep, line]} />
    </View>
  );
}

/** A thin bar with a block that slides along it while something is working. */
export function WorkingBar({ style }: { style?: StyleProp<ViewStyle> }) {
  const moving = useMotion();
  const p = useSharedValue(0);
  useEffect(() => {
    if (!moving) return;
    p.set(withRepeat(withTiming(1, { duration: 1200, easing: Easing.linear }), -1));
  }, [moving, p]);
  const block = useAnimatedStyle(() => ({ left: `${-35 + p.value * 135}%` }));
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Working" style={[styles.track, style]}>
      {moving ? <Animated.View style={[styles.block, block]} /> : <View style={[styles.block, { left: '22%' }]} />}
    </View>
  );
}

/** An empty page with dashed lines: nothing here yet. */
export function EmptyPage() {
  return (
    <View aria-hidden style={styles.page}>
      {['100%', '100%', '100%', '100%', '60%'].map((w, i) => (
        <View key={i} style={{ width: w as DimensionValue, borderTopWidth: 1, borderColor: colors.grey, borderStyle: 'dashed' }} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  receipt: { backgroundColor: colors.page, borderWidth: 1, borderColor: colors.ink, overflow: 'hidden' },
  spread: { flexDirection: 'row', justifyContent: 'space-between' },
  viewfinder: { height: 220, backgroundColor: colors.page, borderWidth: 1, borderColor: colors.rule },
  shade: { position: 'absolute', left: 0, right: 0, top: 0, backgroundColor: 'rgba(17,17,17,0.05)' },
  sweep: { position: 'absolute', left: -14, right: -14, top: 0, height: 1.5, backgroundColor: colors.ink },
  track: { height: 2, backgroundColor: colors.rule, overflow: 'hidden' },
  block: { position: 'absolute', top: 0, bottom: 0, width: '35%', backgroundColor: colors.ink },
  page: { width: 120, height: 150, paddingVertical: 20, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.ink, backgroundColor: colors.page, gap: 14 },
});
