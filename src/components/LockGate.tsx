import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LogoMark } from './brand';
import { timing } from './motion';
import { AppText, Button } from './ui';
import { useSettings } from '@/db/settings';
import { colors, motion } from '@/theme/tokens';

/** "Face ID", "Touch ID", "fingerprint" or "passcode", for the unlock button. */
function useUnlockName(): string {
  const [name, setName] = useState('Face ID');
  useEffect(() => {
    if (Platform.OS === 'web') return;
    LocalAuthentication.supportedAuthenticationTypesAsync()
      .then((types) => {
        const { FACIAL_RECOGNITION, FINGERPRINT } = LocalAuthentication.AuthenticationType;
        if (types.includes(FACIAL_RECOGNITION)) setName(Platform.OS === 'ios' ? 'Face ID' : 'face unlock');
        else if (types.includes(FINGERPRINT)) setName(Platform.OS === 'ios' ? 'Touch ID' : 'fingerprint');
        else setName('passcode');
      })
      .catch(() => setName('passcode'));
  }, []);
  return name;
}

/** Optional Face ID / fingerprint / passcode lock. The app re-locks whenever it goes to the background. */
export function LockGate({ children }: { children: ReactNode }) {
  const settings = useSettings();
  const insets = useSafeAreaInsets();
  const enabled = !!settings?.appLock && Platform.OS !== 'web';
  const [locked, setLocked] = useState(true);
  const [shown, setShown] = useState(true);
  const lockedRef = useRef(true);
  const busy = useRef(false);
  const unlockName = useUnlockName();
  const fade = useSharedValue(1);

  const setLock = useCallback(
    (value: boolean) => {
      lockedRef.current = value;
      setLocked(value);
      if (value) {
        fade.set(1);
        setShown(true);
      } else {
        // The cover fades away once unlocked.
        fade.set(withTiming(0, timing(motion.standard), (done) => {
          if (done) runOnJS(setShown)(false);
        }));
      }
    },
    [fade],
  );

  const unlock = useCallback(async () => {
    if (busy.current || !lockedRef.current) return;
    busy.current = true;
    try {
      const res = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock Xpense' });
      if (res.success) setLock(false);
    } finally {
      busy.current = false;
    }
  }, [setLock]);

  useEffect(() => {
    if (!enabled) return;
    unlock();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') setLock(true);
      // The Face ID sheet itself makes the app briefly inactive → active; only prompt when actually locked.
      if (s === 'active' && lockedRef.current) unlock();
    });
    return () => sub.remove();
  }, [enabled, unlock, setLock]);

  const cover = useAnimatedStyle(() => ({ opacity: fade.value }));

  // Render nothing until settings load, so locked data never flashes on screen.
  if (!settings) return null;

  return (
    <>
      {children}
      {enabled && (locked || shown) && (
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.cover, { paddingBottom: Math.max(insets.bottom, 16) + 32 }, cover]}
          pointerEvents={locked ? 'auto' : 'none'}>
          <View style={styles.middle}>
            <LogoMark size={72} />
            <AppText weight="light" center accessibilityRole="header" style={{ fontSize: 32, lineHeight: 36, letterSpacing: -0.96, marginTop: 32 }}>
              Xpense is locked
            </AppText>
            <AppText muted center style={{ marginTop: 10 }}>
              Your money stays private on this device.
            </AppText>
          </View>
          <Button
            title={`Unlock with ${unlockName}`}
            icon={unlockName === 'Face ID' ? 'faceid' : 'lock'}
            onPress={unlock}
            style={{ alignSelf: 'stretch', maxWidth: 420, width: '100%', marginHorizontal: 'auto' }}
          />
        </Animated.View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  cover: { backgroundColor: colors.paper, paddingHorizontal: 24, alignItems: 'center' },
  middle: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
