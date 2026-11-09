import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { Appear, useMotion, useShake } from '@/components/motion';
import { AppText, haptic, Notice, Screen, TextLink, TopBar } from '@/components/ui';
import { AuthError, useAuth } from '@/lib/auth';
import { colors, fonts } from '@/theme/tokens';

const LENGTH = 6;
const RESEND_AFTER_S = 60;

export default function EmailCode() {
  const { email = '' } = useLocalSearchParams<{ email: string }>();
  const { verifyEmailCode, sendEmailCode } = useAuth();
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [wrong, setWrong] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(RESEND_AFTER_S);
  const [shakeStyle, shake] = useShake();

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const verify = async (value: string) => {
    setBusy(true);
    setError(null);
    try {
      // Success signs the account in; the app then opens on its own.
      await verifyEmailCode(email, value);
    } catch (e) {
      // A short shake and a warning buzz, then the boxes clear for another go.
      haptic('warning');
      setWrong(true);
      shake();
      setError(e instanceof AuthError ? e.message : 'That code didn’t work or has expired. Use the newest email from Xpense, or send a new code.');
      setTimeout(() => {
        setCode('');
        setWrong(false);
        input.current?.focus();
      }, 700);
    } finally {
      setBusy(false);
    }
  };

  const onChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, LENGTH);
    setCode(digits);
    if (error && digits.length > 0) setError(null);
    if (digits.length === LENGTH && !busy) verify(digits);
  };

  const resend = async () => {
    setError(null);
    try {
      await sendEmailCode(email);
      setWait(RESEND_AFTER_S);
      setCode('');
      input.current?.focus();
    } catch (e) {
      haptic('warning');
      setError(e instanceof AuthError ? e.message : 'Couldn’t send a new code. Please try again.');
    }
  };

  return (
    <Screen contentStyle={{ maxWidth: 440 }}>
      <TopBar onBack={() => router.back()} />
      <Appear>
        <AppText variant="headline" accessibilityRole="header" style={{ marginTop: 28 }}>
          Check your email
        </AppText>
        <AppText muted style={{ marginTop: 14 }}>
          We sent a 6-digit code to <AppText weight="medium">{email}</AppText>. Type it in below.
        </AppText>
      </Appear>

      <Pressable onPress={() => input.current?.focus()} accessibilityLabel="6-digit code" style={{ marginTop: 40 }}>
        <Animated.View style={[styles.boxes, shakeStyle]}>
          {Array.from({ length: LENGTH }, (_, i) => {
            const digit = code[i];
            const current = i === code.length && !busy && !wrong;
            const line = wrong ? colors.alert : digit || current ? colors.ink : colors.rule;
            return (
              <View key={i} style={[styles.box, { borderBottomColor: line, borderBottomWidth: current ? 2 : 1 }]}>
                {digit ? (
                  <Appear key={`${i}${digit}`} distance={4} duration={160}>
                    <AppText weight="light" style={styles.digit}>
                      {digit}
                    </AppText>
                  </Appear>
                ) : current ? (
                  <Caret />
                ) : null}
              </View>
            );
          })}
        </Animated.View>
        <TextInput
          ref={input}
          value={code}
          onChangeText={onChange}
          autoFocus
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={LENGTH}
          editable={!busy}
          accessibilityLabel="6-digit code"
          style={styles.hidden}
        />
      </Pressable>

      {Platform.OS === 'ios' && !error && (
        <AppText variant="caption" muted style={{ marginTop: 12 }}>
          On iPhone it fills in from Mail on its own.
        </AppText>
      )}
      {busy && (
        <AppText variant="caption" muted style={{ marginTop: 12 }}>
          Checking…
        </AppText>
      )}
      {error && (
        <Appear distance={4}>
          <Notice tone="alert" style={{ marginTop: 24 }}>
            {error}
          </Notice>
        </Appear>
      )}

      <View style={styles.more}>
        {wait > 0 && !error ? (
          <AppText muted>
            Send a new code in <AppText variant="mono">0:{String(wait).padStart(2, '0')}</AppText>
          </AppText>
        ) : (
          <TextLink label="Send a new code" onPress={resend} style={{ alignSelf: 'flex-start' }} />
        )}
        <TextLink label="Use a different email" onPress={() => router.back()} style={{ alignSelf: 'flex-start' }} />
      </View>
    </Screen>
  );
}

/** A thin blinking caret in the box that's next. Steady with Reduce Motion. */
function Caret() {
  const moving = useMotion();
  const o = useSharedValue(1);
  useEffect(() => {
    if (moving) o.set(withRepeat(withSequence(withTiming(1, { duration: 500 }), withTiming(0, { duration: 500 })), -1));
  }, [moving, o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ width: 1.5, height: 30, backgroundColor: colors.ink }, style]} />;
}

const styles = StyleSheet.create({
  boxes: { flexDirection: 'row', gap: 10 },
  box: { flex: 1, height: 60, alignItems: 'center', justifyContent: 'center' },
  digit: { fontSize: 34, lineHeight: 40, fontFamily: fonts.light },
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  more: { gap: 4, marginTop: 40, paddingTop: 20, borderTopWidth: 1, borderTopColor: colors.rule },
});
