import { Geist_200ExtraLight } from '@expo-google-fonts/geist/200ExtraLight';
import { Geist_300Light } from '@expo-google-fonts/geist/300Light';
import { Geist_400Regular } from '@expo-google-fonts/geist/400Regular';
import { Geist_500Medium } from '@expo-google-fonts/geist/500Medium';
import { GeistMono_400Regular } from '@expo-google-fonts/geist-mono/400Regular';
import { GeistMono_500Medium } from '@expo-google-fonts/geist-mono/500Medium';
import { InstrumentSerif_400Regular_Italic } from '@expo-google-fonts/instrument-serif';
import { useFonts } from 'expo-font';
import { DefaultTheme, Stack, ThemeProvider, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';
import { AppState, Platform, View } from 'react-native';

import { LogoMark } from '@/components/brand';
import { LockGate } from '@/components/LockGate';
import { ToastProvider } from '@/components/Toast';
import { AppText, Button } from '@/components/ui';
import { migrate } from '@/db/migrate';
import { applyDueRecurring } from '@/db/recurring';
import { useSettings } from '@/db/settings';
import { SyncProvider, useSync } from '@/db/SyncProvider';
import { AuthProvider, databaseNameFor, useAuth } from '@/lib/auth';
import { today } from '@/lib/dates';
import { ProProvider } from '@/lib/pro';
import { colors, fonts } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync();

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, primary: colors.ink, background: colors.paper, card: colors.paper, text: colors.ink, border: colors.rule },
  fonts: {
    regular: { fontFamily: fonts.regular, fontWeight: 'normal' as const },
    medium: { fontFamily: fonts.medium, fontWeight: 'normal' as const },
    bold: { fontFamily: fonts.medium, fontWeight: 'normal' as const },
    heavy: { fontFamily: fonts.medium, fontWeight: 'normal' as const },
  },
};

/** Books any salary or bills that came due since the app was last open, then reveals the UI. */
function Bootstrap() {
  const db = useSQLiteContext();
  const settings = useSettings();
  const { ready } = useSync();
  const currency = settings?.currency;

  useEffect(() => {
    // Wait for the first sync, so a paycheck another device already booked isn't booked twice.
    if (!currency || !ready) return;
    const run = () => applyDueRecurring(db, today(), currency).catch((e) => console.warn('[recurring]', e));
    run().finally(() => SplashScreen.hideAsync());
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') run();
    });
    return () => sub.remove();
  }, [db, currency, ready]);

  return null;
}

/** Holds the app on the splash screen until a returning account's settings have synced down. */
function WhenSynced({ children }: { children: ReactNode }) {
  const { ready } = useSync();
  return ready ? children : null;
}

// Every screen draws its own top bar in the Gallery style. New screens slide in from the right; full
// screens that cover a task (a scan to check, the plans) rise from the bottom.
const covering = { presentation: 'fullScreenModal' as const, animation: Platform.OS === 'ios' ? ('default' as const) : ('slide_from_bottom' as const) };

function AppStack({ signedIn }: { signedIn: boolean }) {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.paper },
        animation: Platform.OS === 'ios' ? 'default' : 'slide_from_right',
        animationDuration: 280,
      }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="email-code" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="scan-review" options={covering} />
        <Stack.Screen name="paywall" options={covering} />
        <Stack.Screen name="transaction/[id]" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="goal/index" />
        <Stack.Screen name="goal/edit" />
        <Stack.Screen name="buy-check" />
        <Stack.Screen name="month-review" />
      </Stack.Protected>
    </Stack>
  );
}

function Root() {
  const { status, user } = useAuth();

  useEffect(() => {
    if (status === 'signed-out') SplashScreen.hideAsync();
  }, [status]);

  if (status === 'loading') return null;
  if (!user) return <AppStack signedIn={false} />;
  // One database per account, opened fresh when the account changes.
  return (
    <SQLiteProvider key={user.id} databaseName={databaseNameFor(user.id)} onInit={migrate}>
      <SyncProvider userId={user.id}>
        <ProProvider userId={user.id}>
          <Bootstrap />
          <WhenSynced>
            <LockGate>
              <AppStack signedIn />
            </LockGate>
          </WhenSynced>
        </ProProvider>
      </SyncProvider>
    </SQLiteProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Geist_200ExtraLight,
    Geist_300Light,
    Geist_400Regular,
    Geist_500Medium,
    GeistMono_400Regular,
    GeistMono_500Medium,
    InstrumentSerif_400Regular_Italic,
  });

  // Keep the splash screen up until the fonts are ready (or failed — then the system font is used).
  if (!fontsLoaded && !fontError) return null;

  return (
    <ThemeProvider value={navTheme}>
      <AuthProvider>
        <ToastProvider>
          <StatusBar style="dark" />
          <Root />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

/** Shown instead of a blank screen if something unexpected breaks. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);
  return (
    <View style={{ flex: 1, backgroundColor: colors.paper, justifyContent: 'center', padding: 24 }}>
      <View style={{ width: '100%', maxWidth: 440, alignSelf: 'center' }}>
        <LogoMark size={56} />
        <AppText variant="headline" accessibilityRole="header" style={{ marginTop: 28 }}>
          Something went wrong
        </AppText>
        <AppText muted style={{ marginTop: 12 }}>
          Your entries are safe on this device and in your account. Try again, and if it keeps happening, restart the app.
        </AppText>
        {__DEV__ && (
          <AppText variant="small" muted selectable style={{ marginTop: 12 }}>
            {error.message}
          </AppText>
        )}
        <Button title="Try again" onPress={retry} style={{ marginTop: 32 }} />
      </View>
    </View>
  );
}
