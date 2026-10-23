import Ionicons from '@expo/vector-icons/Ionicons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';

import { AppText, Button } from './ui';
import { useSettings } from '@/db/settings';
import { space, useColors } from '@/theme/tokens';

/** Optional Face ID / fingerprint / passcode lock. The app re-locks whenever it goes to the background. */
export function LockGate({ children }: { children: ReactNode }) {
  const settings = useSettings();
  const c = useColors();
  const enabled = !!settings?.appLock && Platform.OS !== 'web';
  const [locked, setLocked] = useState(true);
  const lockedRef = useRef(true);
  const busy = useRef(false);

  const setLock = useCallback((value: boolean) => {
    lockedRef.current = value;
    setLocked(value);
  }, []);

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

  // Render nothing until settings load, so locked data never flashes on screen.
  if (!settings) return null;

  return (
    <>
      {children}
      {enabled && locked && (
        <View style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: c.bg }]}>
          <Ionicons name="shield-checkmark" size={56} color={c.primary} />
          <AppText variant="title">Xpense is locked</AppText>
          <AppText muted style={{ textAlign: 'center' }}>
            Your money data stays private on this phone.
          </AppText>
          <Button title="Unlock" icon="lock-open-outline" onPress={unlock} style={{ alignSelf: 'stretch' }} />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xxl },
});
