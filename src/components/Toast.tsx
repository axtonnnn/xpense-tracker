import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { timing, useMotion } from './motion';
import { AppText, haptic } from './ui';
import { colors, motion, useWide } from '@/theme/tokens';

type ToastInput = {
  message: string;
  /** Offers Undo for a few seconds. */
  undo?: () => void;
  /** No success tick (e.g. a gentle note rather than a confirmation). */
  quiet?: boolean;
};
type ToastState = ToastInput & { id: number };

const ToastContext = createContext<(t: ToastInput) => void>(() => undefined);

/** Height of the phone tab bar above the home indicator, so toasts sit just above it. */
const TAB_BAR = 64;

/** An ink strip that slides up after a save, waits, then slides away. Undo is right there when it helps. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const wide = useWide();
  const moving = useMotion();
  const [toast, setToast] = useState<ToastState | null>(null);
  const p = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((t: ToastInput) => {
    if (!t.quiet) haptic('success');
    setToast({ ...t, id: Date.now() });
  }, []);

  const hide = useCallback(
    (id: number) => {
      p.set(withTiming(0, timing(motion.standard), (done) => {
        if (done) runOnJS(setToast)((cur: ToastState | null) => (cur?.id === id ? null : cur));
      }));
    },
    [p],
  );

  useEffect(() => {
    if (!toast) return;
    p.set(0);
    p.set(withTiming(1, timing(motion.standard)));
    timer.current = setTimeout(() => hide(toast.id), toast.undo ? 4500 : 2600);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [toast, p, hide]);

  const anim = useAnimatedStyle(() =>
    moving ? { opacity: Math.min(1, p.value * 2), transform: [{ translateY: (1 - p.value) * 72 }] } : { opacity: p.value },
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <Animated.View
          accessibilityLiveRegion="polite"
          role="status"
          style={[
            styles.toast,
            wide ? styles.wide : { left: 16, right: 16 },
            { bottom: wide ? 24 : insets.bottom + TAB_BAR + 12 },
            anim,
          ]}>
          <AppText color={colors.onInk} style={{ flex: 1, fontSize: 14, lineHeight: 20 }} numberOfLines={2}>
            {toast.message}
          </AppText>
          {toast.undo && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Undo"
              hitSlop={12}
              onPress={() => {
                haptic('light');
                toast.undo?.();
                hide(toast.id);
              }}>
              <AppText color={colors.onInk} style={{ fontSize: 14, textDecorationLine: 'underline' }}>
                Undo
              </AppText>
            </Pressable>
          )}
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): (t: ToastInput) => void {
  return useContext(ToastContext);
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.ink,
  },
  wide: { right: 24, width: 380 },
});
