import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, useColorScheme } from 'react-native';

import { LockGate } from '@/components/LockGate';
import { migrate } from '@/db/migrate';
import { applyDueRecurring } from '@/db/recurring';
import { useSettings } from '@/db/settings';
import { today } from '@/lib/dates';
import { ProProvider } from '@/lib/pro';
import { useColors } from '@/theme/tokens';

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
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, primary: c.primary, background: c.bg, card: c.bg, text: c.ink, border: c.border },
  };

  return (
    <SQLiteProvider databaseName="xpense.db" onInit={migrate}>
      <ThemeProvider value={navTheme}>
        <ProProvider>
          <Bootstrap />
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <LockGate>
            <Stack
              screenOptions={{
                headerShadowVisible: false,
                headerTintColor: c.primary,
                headerTitleStyle: { color: c.ink },
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
        </ProProvider>
      </ThemeProvider>
    </SQLiteProvider>
  );
}
