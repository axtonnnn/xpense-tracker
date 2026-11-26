// Sheets rise from the bottom with a gentle spring while the screen behind dims; dialogs fade and settle
// in the middle. Both are white with an ink edge and close on the scrim, the grabber or the back button.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { timing, useMotion } from './motion';
import { AppText, Button } from './ui';
import { colors, motion, useWide } from '@/theme/tokens';

const SPRING = { damping: 26, stiffness: 260, mass: 1, overshootClamping: false } as const;

/** Keeps a closing sheet on screen until its exit animation ends. */
function usePresence(open: boolean, onGone: () => void) {
  const moving = useMotion();
  const [mounted, setMounted] = useState(open);
  const p = useSharedValue(0);
  // Opening mounts it straight away (a render-time update, so the first frame already has it).
  if (open && !mounted) setMounted(true);

  useEffect(() => {
    if (open) {
      p.set(moving ? withSpring(1, SPRING) : withTiming(1, timing(motion.standard)));
    } else if (mounted) {
      p.set(withTiming(0, timing(moving ? motion.standard : motion.quick), (done) => {
        if (done) runOnJS(setMounted)(false);
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reacts to open only
  }, [open]);

  useEffect(() => {
    if (!mounted && !open) onGone();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires when the exit finishes
  }, [mounted]);

  return { mounted, p, moving };
}

/**
 * A bottom sheet. Render it with `open` and close it by setting `open` to false (from `onClose`), so it
 * can slide away first.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  onGone = () => undefined,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Called once the sheet has fully left the screen. */
  onGone?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const wide = useWide();
  const { mounted, p, moving } = usePresence(open, onGone);
  const [height, setHeight] = useState(600);

  const scrim = useAnimatedStyle(() => ({ opacity: Math.min(1, p.value) }));
  const sheet = useAnimatedStyle(() =>
    moving ? { transform: [{ translateY: (1 - p.value) * (height + 40) }] } : { opacity: Math.min(1, p.value) },
  );

  if (!mounted) return null;
  return (
    <Modal transparent visible animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }, scrim]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
      </Animated.View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetHost} pointerEvents="box-none">
        <Animated.View
          accessibilityViewIsModal
          role="dialog"
          aria-label={title}
          onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 24 }, wide && styles.sheetWide, sheet]}>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={12} style={styles.grabberHit}>
            <View style={styles.grabber} />
          </Pressable>
          {title && (
            <AppText variant="title" accessibilityRole="header" style={{ marginTop: 20 }}>
              {title}
            </AppText>
          )}
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** A centred dialog for a decision that needs a pause, like deleting an account. */
export function Dialog({
  open,
  onClose,
  title,
  children,
  onGone = () => undefined,
  style,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  onGone?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { mounted, p, moving } = usePresence(open, onGone);
  const scrim = useAnimatedStyle(() => ({ opacity: Math.min(1, p.value) }));
  const box = useAnimatedStyle(() => ({
    opacity: Math.min(1, p.value),
    transform: moving ? [{ translateY: (1 - p.value) * 12 }, { scale: 0.98 + 0.02 * p.value }] : [],
  }));
  if (!mounted) return null;
  return (
    <Modal transparent visible animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }, scrim]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
      </Animated.View>
      <View style={styles.dialogHost} pointerEvents="box-none">
        <Animated.View accessibilityViewIsModal role="alertdialog" aria-label={title} style={[styles.dialog, style, box]}>
          <AppText weight="light" accessibilityRole="header" style={{ fontSize: 30, lineHeight: 34, letterSpacing: -0.9 }}>
            {title}
          </AppText>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

type Ask = { title: string; body: string; confirm: string; open: boolean };

/**
 * A yes/no question in a dialog, for deleting things: `const [dialog, ask] = useConfirm()`, render
 * `dialog`, then `if (await ask('Delete this?', 'It can’t be undone.')) …`.
 */
export function useConfirm(): [ReactNode, (title: string, body: string, confirm?: string) => Promise<boolean>] {
  const [ask, setAsk] = useState<Ask | null>(null);
  const resolver = useRef<((answer: boolean) => void) | null>(null);
  const answer = (yes: boolean) => {
    resolver.current?.(yes);
    resolver.current = null;
    setAsk((a) => (a ? { ...a, open: false } : a));
  };
  const element = ask ? (
    <Dialog open={ask.open} onClose={() => answer(false)} onGone={() => setAsk(null)} title={ask.title}>
      <AppText style={{ marginTop: 14 }}>{ask.body}</AppText>
      <Button kind="danger" title={ask.confirm} onPress={() => answer(true)} style={{ marginTop: 24 }} />
      <Button kind="secondary" title="Cancel" onPress={() => answer(false)} style={{ marginTop: 10 }} />
    </Dialog>
  ) : null;
  const open = (title: string, body: string, confirm = 'Delete') =>
    new Promise<boolean>((resolve) => {
      resolver.current?.(false);
      resolver.current = resolve;
      setAsk({ title, body, confirm, open: true });
    });
  return [element, open];
}

const styles = StyleSheet.create({
  sheetHost: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.page,
    borderTopWidth: 1,
    borderTopColor: colors.ink,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  sheetWide: { width: '100%', maxWidth: 520, alignSelf: 'center', borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.ink },
  grabberHit: { alignSelf: 'center', paddingVertical: 4, paddingHorizontal: 20 },
  grabber: { width: 36, height: 3, backgroundColor: colors.rule },
  dialogHost: { flex: 1, justifyContent: 'center', paddingHorizontal: 20 },
  dialog: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    padding: 24,
    backgroundColor: colors.page,
    borderWidth: 1,
    borderColor: colors.ink,
  },
});
