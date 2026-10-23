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
  const busy = useRef(false);

  const unlock = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const res = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock Xpense' });
      if (res.success) setLocked(false);
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    unlock();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') setLocked(true);
      if (s === 'active') unlock();
    });
    return () => sub.remove();
  }, [enabled, unlock]);

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
