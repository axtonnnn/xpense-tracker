import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, View } from 'react-native';

import { Logo } from '@/components/brand';
import { ReceiptSketch } from '@/components/illustrations';
import { SketchRule } from '@/components/sketch';
import { AppText, Banner, Button, Field, Row, Screen, TextLink } from '@/components/ui';
import { AuthError, useAuth } from '@/lib/auth';
import { ACCOUNTS_READY, PRIVACY_URL, TERMS_URL } from '@/lib/config';
import { colors, space } from '@/theme/tokens';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function SignIn() {
  const { appleAvailable, signInWithApple, sendEmailCode, signInPreview } = useAuth();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState<'apple' | 'email' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apple = async () => {
    setError(null);
    setBusy('apple');
    try {
      await signInWithApple();
    } catch (e) {
      setError(e instanceof AuthError ? e.message : 'Sign in with Apple didn’t work. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const sendCode = async () => {
    setError(null);
    const clean = email.trim();
    if (!EMAIL.test(clean)) return setError('Type your email address, like you@example.com.');
    setBusy('email');
    try {
      await sendEmailCode(clean);
      router.push({ pathname: '/email-code', params: { email: clean } });
    } catch (e) {
      setError(e instanceof AuthError ? e.message : 'Couldn’t send the code. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen topInset contentStyle={{ maxWidth: 440, gap: 0 }}>
      <Logo size={28} />
      <View style={{ alignItems: 'center', marginTop: space.lg }}>
        <ReceiptSketch width={326} />
      </View>

      <AppText variant="display" style={{ fontSize: 40, lineHeight: 42, marginTop: space.lg }} accessibilityRole="header">
        Spend on what{'\n'}matters.
      </AppText>
      <AppText muted style={{ marginTop: 10, fontSize: 15, lineHeight: 22 }}>
        Your money, kept like a sketchbook. Sign in to keep it on your phone, iPad and Mac.
      </AppText>

      {!ACCOUNTS_READY && (
        <View style={{ marginTop: space.lg }}>
          <Banner tone="warn">
            Sign-in isn’t set up in this build yet. Add your Supabase URL and key to app.json (see LAUNCH.md, step 2).
          </Banner>
        </View>
      )}

      <View style={{ gap: 12, marginTop: 22 }}>
        {appleAvailable && Platform.OS === 'ios' && (
          <View style={{ opacity: busy ? 0.5 : 1 }} pointerEvents={busy ? 'none' : 'auto'}>
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={2}
              style={{ height: 52, width: '100%' }}
              onPress={apple}
            />
          </View>
        )}
      </View>

      {appleAvailable && Platform.OS === 'ios' && (
        <Row style={{ marginTop: 18, gap: 12 }}>
          <SketchRule seed={11} opacity={0.35} style={{ flex: 1 }} />
          <AppText variant="note" faint style={{ fontSize: 20 }}>
            or
          </AppText>
          <SketchRule seed={12} opacity={0.35} style={{ flex: 1 }} />
        </Row>
      )}

      <View style={{ marginTop: 8 }}>
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="send"
          onSubmitEditing={sendCode}
          right={
            <Pressable
              onPress={sendCode}
              disabled={!!busy}
              accessibilityRole="button"
              accessibilityLabel="Email me a code"
              style={({ pressed }) => ({
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: colors.ink,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed || busy ? 0.6 : 1,
              })}>
              {busy === 'email' ? (
                <ActivityIndicator color={colors.onInk} size="small" />
              ) : (
                <AppText color={colors.onInk} style={{ fontSize: 18, lineHeight: 20 }}>
                  →
                </AppText>
              )}
            </Pressable>
          }
        />
        <AppText variant="caption" faint style={{ marginTop: 8 }}>
          We’ll email you a 6-digit code. No password to remember.
        </AppText>
      </View>

      {error && (
        <View style={{ marginTop: space.lg }}>
          <Banner tone="danger">{error}</Banner>
        </View>
      )}

      {signInPreview && (
        <View style={{ marginTop: space.xl }}>
          <Button title="Try it without an account" kind="secondary" onPress={signInPreview} />
          <AppText variant="caption" faint center style={{ marginTop: 6 }}>
            Development builds only. Nothing syncs.
          </AppText>
        </View>
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 4, marginTop: space.xl }}>
        <AppText variant="caption" faint>
          By continuing you agree to the
        </AppText>
        {TERMS_URL ? <TextLink label="Terms" muted onPress={() => Linking.openURL(TERMS_URL)} /> : <AppText variant="caption" faint>Terms</AppText>}
        <AppText variant="caption" faint>
          and
        </AppText>
        {PRIVACY_URL ? (
          <TextLink label="Privacy Policy" muted onPress={() => Linking.openURL(PRIVACY_URL)} />
        ) : (
          <AppText variant="caption" faint>
            Privacy Policy
          </AppText>
        )}
      </View>
    </Screen>
  );
}
