import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Linking, Platform, StyleSheet, View } from 'react-native';

import { Logo } from '@/components/brand';
import { Icon } from '@/components/icons';
import { Hatch } from '@/components/marks';
import { Appear, GrowX } from '@/components/motion';
import { AppText, Button, Field, haptic, Notice, PressableScale, Screen } from '@/components/ui';
import { AuthError, useAuth } from '@/lib/auth';
import { ACCOUNTS_READY, PRIVACY_URL, TERMS_URL } from '@/lib/config';
import { colors, motion } from '@/theme/tokens';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function SignIn() {
  const { appleAvailable, signInWithApple, sendEmailCode, signInPreview } = useAuth();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState<'apple' | 'email' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const apple = appleAvailable && Platform.OS === 'ios';

  const signInApple = async () => {
    setError(null);
    setBusy('apple');
    try {
      await signInWithApple();
    } catch (e) {
      haptic('warning');
      setError(e instanceof AuthError ? e.message : 'Sign in with Apple didn’t work. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const sendCode = async () => {
    setError(null);
    const clean = email.trim();
    if (!EMAIL.test(clean)) {
      haptic('warning');
      return setError('Type your email address, like you@example.com.');
    }
    setBusy('email');
    try {
      await sendEmailCode(clean);
      router.push({ pathname: '/email-code', params: { email: clean } });
    } catch (e) {
      haptic('warning');
      setError(e instanceof AuthError ? e.message : 'Couldn’t send the code. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen contentStyle={{ maxWidth: 440, paddingBottom: 40 }}>
      <Appear>
        <Logo size={26} />
      </Appear>

      <View aria-hidden style={{ marginTop: 72 }}>
        <View style={{ height: 22 }}>
          <AppText variant="axis" muted style={[styles.at, { left: 0 }]}>
            needs
          </AppText>
          <AppText variant="axis" muted style={[styles.at, { left: '56%' }]}>
            wants
          </AppText>
          <AppText variant="axis" muted style={[styles.at, { right: 0 }]}>
            left
          </AppText>
          {['0%', '54%', '66%'].map((l) => (
            <View key={l} style={[styles.tick, { left: l as `${number}%` }]} />
          ))}
          <View style={[styles.tick, { right: 0 }]} />
        </View>
        <View style={styles.bar}>
          <GrowX delay={200} style={{ width: '54%', backgroundColor: colors.ink }} />
          <GrowX delay={200 + motion.barStagger} style={{ width: '12%', overflow: 'hidden' }}>
            <Hatch />
          </GrowX>
        </View>
      </View>

      <Appear delay={120}>
        <AppText weight="light" accessibilityRole="header" style={styles.headline}>
          Spend on what matters.
        </AppText>
        <AppText muted style={{ marginTop: 14 }}>
          Your money, laid out clearly. Sign in to keep it on your phone, iPad and Mac.
        </AppText>
      </Appear>

      {!ACCOUNTS_READY && (
        <Notice style={{ marginTop: 24 }}>Sign-in isn’t set up in this build yet. Add your Supabase URL and key to app.json (see LAUNCH.md, step 2).</Notice>
      )}

      <Appear delay={200}>
        {apple && (
          <View style={{ marginTop: 36, opacity: busy ? 0.5 : 1 }} pointerEvents={busy ? 'none' : 'auto'}>
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={0}
              style={{ height: 52, width: '100%' }}
              onPress={signInApple}
            />
          </View>
        )}

        {apple && (
          <View style={styles.or}>
            <View style={styles.orLine} />
            <AppText variant="caption" muted>
              or
            </AppText>
            <View style={styles.orLine} />
          </View>
        )}

        <View style={{ marginTop: apple ? 18 : 36 }}>
          <AppText variant="caption" muted>
            Email
          </AppText>
          <View style={styles.emailRow}>
            <View style={{ flex: 1 }}>
              <Field
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                accessibilityLabel="Email"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="send"
                onSubmitEditing={sendCode}
              />
            </View>
            <PressableScale
              onPress={sendCode}
              disabled={!!busy}
              haptics="light"
              accessibilityRole="button"
              accessibilityLabel="Email me a code"
              style={styles.go}>
              {busy === 'email' ? <ActivityIndicator color={colors.onInk} size="small" /> : <Icon name="arrow" size={20} color={colors.onInk} strokeWidth={1.5} />}
            </PressableScale>
          </View>
          <AppText variant="caption" muted style={{ marginTop: 10 }}>
            We’ll email you a 6-digit code. No password to remember.
          </AppText>
        </View>
      </Appear>

      {error && (
        <Appear distance={4}>
          <Notice tone="alert" style={{ marginTop: 20 }}>
            {error}
          </Notice>
        </Appear>
      )}

      {signInPreview && (
        <View style={{ marginTop: 32 }}>
          <Button title="Try it without an account" kind="secondary" onPress={signInPreview} />
          <AppText variant="small" muted center style={{ marginTop: 8 }}>
            Development builds only. Nothing syncs.
          </AppText>
        </View>
      )}

      <View style={styles.legal}>
        <AppText variant="small" muted center style={{ lineHeight: 17 }}>
          By continuing you agree to the{' '}
          <AppText variant="small" style={styles.link} onPress={TERMS_URL ? () => Linking.openURL(TERMS_URL) : undefined} accessibilityRole="link">
            Terms
          </AppText>{' '}
          and the{' '}
          <AppText variant="small" style={styles.link} onPress={PRIVACY_URL ? () => Linking.openURL(PRIVACY_URL) : undefined} accessibilityRole="link">
            Privacy Policy
          </AppText>
          .
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  at: { position: 'absolute', top: 0 },
  tick: { position: 'absolute', bottom: 0, width: 1, height: 6, backgroundColor: colors.ink },
  bar: { flexDirection: 'row', height: 12, borderWidth: 1, borderColor: colors.ink, backgroundColor: colors.page, overflow: 'hidden' },
  headline: { fontSize: 48, lineHeight: 50, letterSpacing: -2.16, marginTop: 28 },
  or: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 24 },
  orLine: { flex: 1, height: 1, backgroundColor: colors.rule },
  emailRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  go: { width: 44, height: 44, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  legal: { marginTop: 'auto', paddingTop: 40 },
  link: { color: colors.ink, textDecorationLine: 'underline' },
});
