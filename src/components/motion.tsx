// Small, quick motion, only where it helps you see what changed (see the Motion board on the design
// canvas). Everything here respects Reduce Motion: slides and counts become simple fades, haptics stay.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  type AnimatedStyle,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { CURVE, motion } from '@/theme/tokens';

/** cubic-bezier(0.2, 0, 0, 1): fast start, soft stop. */
export const ease = Easing.bezier(...CURVE);
const easeFn = Easing.bezierFn(...CURVE);

export function timing(duration: number) {
  return { duration, easing: ease };
}

/** False when the person turned on Reduce Motion. */
export function useMotion(): boolean {
  return !useReducedMotion();
}

/**
 * Fades in and rises a few points the first time it mounts. `delay` staggers rows; pass `skip` to show it
 * straight away (e.g. rows that scroll into view later).
 */
export function Appear({
  children,
  delay = 0,
  distance = 6,
  duration = motion.standard,
  skip,
  style,
}: {
  children: ReactNode;
  delay?: number;
  distance?: number;
  duration?: number;
  skip?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const moving = useMotion();
  // Decided once, on mount: later re-renders never replay the entrance.
  const [animate] = useState(!skip);
  const p = useSharedValue(animate ? 0 : 1);
  useEffect(() => {
    if (animate) p.set(withDelay(delay, withTiming(1, timing(duration))));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once, on mount
  }, []);
  const anim = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ translateY: moving ? (1 - p.value) * distance : 0 }],
  }));
  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}

/**
 * Rows fade in 30 ms apart when a list first loads, and only then: rows that mount later (scrolling, a
 * new entry) just appear. Returns the delay for row `index`, or `undefined` to skip the entrance.
 */
export function useEntrance(limit = 12): (index: number) => number | undefined {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSettled(true), 900);
    return () => clearTimeout(t);
  }, []);
  return (index) => (settled || index >= limit ? undefined : index * motion.rowStagger);
}

/**
 * A number that counts up to its value: from zero over 700 ms the first time, then from the old value
 * to the new one when it changes. Reduce Motion shows the value straight away.
 */
export function useCountUp(value: number, { duration = motion.showy }: { duration?: number } = {}): number {
  const moving = useMotion();
  const [shown, setShown] = useState(moving ? 0 : value);
  const from = useRef(moving ? 0 : value);
  const first = useRef(true);

  useEffect(() => {
    const start = from.current;
    const length = first.current ? duration : Math.min(duration, 420);
    first.current = false;
    if (!moving || start === value) {
      from.current = value;
      setShown(value);
      return;
    }
    let frame = 0;
    const began = Date.now();
    const step = () => {
      const t = Math.min(1, (Date.now() - began) / length);
      const v = start + (value - start) * easeFn(t);
      from.current = v;
      setShown(v);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, moving, duration]);

  return Math.round(shown);
}

/**
 * A bar part that grows from its left edge (the month bar, a goal's progress). Stagger parts with
 * `delay`. Reduce Motion fades it in instead.
 */
export function GrowX({ children, delay = 0, style, duration = motion.showy }: { children?: ReactNode; delay?: number; style?: StyleProp<ViewStyle>; duration?: number }) {
  const moving = useMotion();
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(withDelay(delay, withTiming(1, timing(moving ? duration : motion.standard))));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once, on mount
  }, []);
  const anim = useAnimatedStyle(() =>
    moving ? { transform: [{ scaleX: Math.max(p.value, 0.0001) }] } : { opacity: p.value },
  );
  return <Animated.View style={[{ transformOrigin: 'left center' }, style, anim]}>{children}</Animated.View>;
}

/** A chart column that rises from the baseline. Columns are staggered 40 ms apart. */
export function Rise({ children, delay = 0, style }: { children?: ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const moving = useMotion();
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(withDelay(delay, withTiming(1, timing(moving ? motion.showy : motion.standard))));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once, on mount
  }, []);
  const anim = useAnimatedStyle(() =>
    moving ? { transform: [{ scaleY: Math.max(p.value, 0.0001) }] } : { opacity: p.value },
  );
  return <Animated.View style={[{ transformOrigin: 'center bottom' }, style, anim]}>{children}</Animated.View>;
}

/**
 * A width that eases to a new fraction (0–1) whenever it changes: the goal bar filling as money is
 * added. Starts from zero on first view.
 */
export function useFill(fraction: number, { delay = 0 }: { delay?: number } = {}) {
  const moving = useMotion();
  const p = useSharedValue(0);
  const first = useRef(true);
  useEffect(() => {
    const target = Math.max(0, Math.min(1, fraction));
    const length = first.current ? motion.showy : motion.calm;
    p.set(moving ? withDelay(first.current ? delay : 0, withTiming(target, timing(length))) : target);
    first.current = false;
  }, [fraction, moving, delay, p]);
  return useAnimatedStyle(() => ({ width: `${p.value * 100}%` }));
}

/** A short side-to-side shake for a wrong code. Reduce Motion skips it (the warning haptic stays). */
export function useShake(): [AnimatedStyle<ViewStyle>, () => void] {
  const moving = useMotion();
  const x = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const shake = () => {
    if (!moving) return;
    const t = (to: number) => withTiming(to, { duration: 50, easing: ease });
    x.set(withSequence(t(-8), t(7), t(-5), t(3), t(0)));
  };
  return [style, shake];
}
