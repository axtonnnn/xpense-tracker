import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { SketchCircle } from '@/components/sketch';
import { AppText, Banner, Screen, TextLink } from '@/components/ui';
import { AuthError, useAuth } from '@/lib/auth';
import { colors, fonts, space } from '@/theme/tokens';

const LENGTH = 6;
const RESEND_AFTER_S = 60;

export default function EmailCode() {
  const { email = '' } = useLocalSearchParams<{ email: string }>();
  const { verifyEmailCode, sendEmailCode } = useAuth();
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(RESEND_AFTER_S);

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
      setError(e instanceof AuthError ? e.message : 'That code didn’t work. Please try again.');
      setCode('');
      input.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  const onChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, LENGTH);
    setCode(digits);
    if (digits.length === LENGTH && !busy) verify(digits);
  };

  const resend = async () => {
    setError(null);
    try {
      await sendEmailCode(email);
      setWait(RESEND_AFTER_S);
    } catch (e) {
      setError(e instanceof AuthError ? e.message : 'Couldn’t send a new code. Please try again.');
    }
  };

  return (
    <Screen topInset contentStyle={{ maxWidth: 440, paddingTop: 96 }}>
      <AppText variant="display" style={{ fontSize: 40, lineHeight: 44 }} accessibilityRole="header">
        Check your email
      </AppText>
      <AppText muted style={{ fontSize: 15, lineHeight: 22 }}>
        We sent a 6-digit code to <AppText weight="medium">{email}</AppText>. Type it in below.
      </AppText>

      <Pressable onPress={() => input.current?.focus()} accessibilityLabel="Code" style={styles.rings}>
        {Array.from({ length: LENGTH }, (_, i) => (
          <SketchCircle key={i} size={50} seed={5 + i * 7}>
            <Text style={styles.digit}>{code[i] ?? (i === code.length && !busy ? '|' : '')}</Text>
          </SketchCircle>
        ))}
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

      {Platform.OS === 'ios' && (
        <AppText variant="note" muted style={{ alignSelf: 'flex-end', transform: [{ rotate: '-2deg' }] }}>
          it fills in from Mail on its own
        </AppText>
      )}

      {busy && <AppText faint>Checking…</AppText>}
      {error && <Banner tone="danger">{error}</Banner>}

      <View style={{ gap: 14, marginTop: space.md }}>
        {wait > 0 ? (
          <AppText faint style={{ fontSize: 15 }}>
            Send a new code in 0:{String(wait).padStart(2, '0')}
          </AppText>
        ) : (
          <TextLink label="Send a new code" onPress={resend} />
        )}
        <TextLink label="Use a different email" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  rings: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.xl },
  digit: { fontFamily: fonts.serif, fontSize: 32, lineHeight: 38, color: colors.ink },
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0 },
});
