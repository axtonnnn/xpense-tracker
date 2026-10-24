import {
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/manrope';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, useColorScheme, View } from 'react-native';

import { AppIcon } from '@/components/brand';
import { LockGate } from '@/components/LockGate';
import { ToastProvider } from '@/components/Toast';
import { AppText, Button } from '@/components/ui';
import { migrate } from '@/db/migrate';
import { applyDueRecurring } from '@/db/recurring';
import { useSettings } from '@/db/settings';
import { today } from '@/lib/dates';
import { ProProvider } from '@/lib/pro';
import { fonts, space, useColors } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync();

/** Books any salary or bills that came due since the app was last open, then reveals the UI. */
function Bootstrap() {
  const db = useSQLiteContext();
  const settings = useSettings();
  const currency = settings?.currency;

  useEffect(() => {
    if (!currency) return;
    const run = () => applyDueRecurring(db, today(), currency).catch((e) => console.warn('[recurring]', e));
    run().finally(() => SplashScreen.hideAsync());
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') run();
    });
    return () => sub.remove();
  }, [db, currency]);

  return null;
}

export default function RootLayout() {
  const scheme = useColorScheme();
  const c = useColors();
  const [fontsLoaded, fontError] = useFonts({ Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold });

  // Keep the splash screen up until the brand font is ready (or failed — then the system font is used).
  if (!fontsLoaded && !fontError) return null;

  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, primary: c.primary, background: c.bg, card: c.bg, text: c.ink, border: c.border },
    fonts: {
      regular: { fontFamily: fonts.medium, fontWeight: 'normal' as const },
      medium: { fontFamily: fonts.semibold, fontWeight: 'normal' as const },
      bold: { fontFamily: fonts.bold, fontWeight: 'normal' as const },
      heavy: { fontFamily: fonts.extrabold, fontWeight: 'normal' as const },
    },
  };

  return (
    <SQLiteProvider databaseName="xpense.db" onInit={migrate}>
      <ThemeProvider value={navTheme}>
        <ProProvider>
          <ToastProvider>
            <Bootstrap />
            <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
            <LockGate>
              <Stack
                screenOptions={{
                  headerShadowVisible: false,
                  headerTintColor: c.primary,
                  headerTitleStyle: { color: c.ink, fontFamily: fonts.bold },
                  headerStyle: { backgroundColor: c.bg },
                  contentStyle: { backgroundColor: c.bg },
                  headerBackButtonDisplayMode: 'minimal',
                }}>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
                <Stack.Screen name="scan-review" options={{ title: 'Review scan', presentation: 'modal' }} />
                <Stack.Screen name="transaction/[id]" options={{ title: 'Transaction' }} />
                <Stack.Screen name="settings" options={{ title: 'Settings' }} />
                <Stack.Screen name="paywall" options={{ headerShown: false, presentation: 'modal' }} />
              </Stack>
            </LockGate>
          </ToastProvider>
        </ProProvider>
      </ThemeProvider>
    </SQLiteProvider>
  );
}

/** Shown instead of a blank screen if something unexpected breaks. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const c = useColors();
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', padding: space.xxl, gap: space.md }}>
      <AppIcon size={72} />
      <AppText variant="title" center>
        Something went wrong
      </AppText>
      <AppText muted center>
        Your data is safe on this phone. Try again, and if it keeps happening, restart the app.
      </AppText>
      {__DEV__ && (
        <AppText variant="caption" muted center selectable>
          {error.message}
        </AppText>
      )}
      <Button title="Try again" icon="refresh" onPress={retry} style={{ alignSelf: 'stretch' }} />
    </View>
  );
}
