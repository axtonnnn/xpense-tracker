import Ionicons from '@expo/vector-icons/Ionicons';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Animated, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, haptic, type IconName } from './ui';
import { elevation, radius, useColors } from '@/theme/tokens';

type ToastInput = { message: string; icon?: IconName; tone?: 'success' | 'info' };
type ToastState = ToastInput & { id: number };

const ToastContext = createContext<(t: ToastInput) => void>(() => undefined);

const useNative = Platform.OS !== 'web';

/** A short confirmation that slides in at the top and leaves on its own. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastState | null>(null);
  const [anim] = useState(() => new Animated.Value(0));

  const show = useCallback((t: ToastInput) => {
    if (t.tone !== 'info') haptic('success');
    setToast({ ...t, id: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) return;
    anim.setValue(0);
    Animated.spring(anim, { toValue: 1, useNativeDriver: useNative, friction: 8 }).start();
    const timer = setTimeout(() => {
      Animated.timing(anim, { toValue: 0, duration: 220, useNativeDriver: useNative }).start(({ finished }) => {
        if (finished) setToast((cur) => (cur?.id === toast.id ? null : cur));
      });
    }, 2600);
    return () => clearTimeout(timer);
  }, [toast, anim]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <Animated.View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          style={[
            styles.toast,
            elevation(false, 2),
            {
              top: insets.top + 8,
              backgroundColor: c.ink,
              opacity: anim,
              transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
            },
          ]}>
          <Ionicons name={toast.icon ?? 'checkmark-circle'} size={20} color={c.mint} />
          <AppText weight="semibold" color={c.bg} style={{ flexShrink: 1 }}>
            {toast.message}
          </AppText>
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
    alignSelf: 'center',
    maxWidth: 420,
    marginHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: radius.pill,
  },
});
