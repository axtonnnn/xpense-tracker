import { Caveat_500Medium } from '@expo-google-fonts/caveat';
import { InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic } from '@expo-google-fonts/instrument-serif';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, useFonts } from '@expo-google-fonts/inter';
import { DefaultTheme, Stack, ThemeProvider, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';
import { AppState, View } from 'react-native';

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
import { colors, fonts, space } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync();

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, primary: colors.ink, background: colors.paper, card: colors.paper, text: colors.ink, border: colors.line },
  fonts: {
    regular: { fontFamily: fonts.regular, fontWeight: 'normal' as const },
    medium: { fontFamily: fonts.medium, fontWeight: 'normal' as const },
    bold: { fontFamily: fonts.semibold, fontWeight: 'normal' as const },
    heavy: { fontFamily: fonts.semibold, fontWeight: 'normal' as const },
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

function AppStack({ signedIn }: { signedIn: boolean }) {
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerTintColor: colors.ink,
        headerTitleStyle: { color: colors.ink, fontFamily: fonts.semibold },
        headerStyle: { backgroundColor: colors.paper },
        contentStyle: { backgroundColor: colors.paper },
        headerBackButtonDisplayMode: 'minimal',
      }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        <Stack.Screen name="email-code" options={{ title: '', headerTransparent: true }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="scan-review" options={{ title: 'Check the scan', presentation: 'modal' }} />
        <Stack.Screen name="transaction/[id]" options={{ title: '' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="paywall" options={{ headerShown: false, presentation: 'modal' }} />
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
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Caveat_500Medium,
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
    <View style={{ flex: 1, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', padding: space.xxl, gap: space.md }}>
      <LogoMark size={64} />
      <AppText variant="title" center>
        Something went wrong
      </AppText>
      <AppText muted center>
        Your entries are safe on this device and in your account. Try again, and if it keeps happening, restart the app.
      </AppText>
      {__DEV__ && (
        <AppText variant="caption" muted center selectable>
          {error.message}
        </AppText>
      )}
      <Button title="Try again" onPress={retry} style={{ alignSelf: 'stretch' }} />
    </View>
  );
}
