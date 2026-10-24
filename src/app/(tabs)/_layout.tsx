import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';

import { TabBar } from '@/components/TabBar';
import { useSettings } from '@/db/settings';
import { fonts, useColors } from '@/theme/tokens';

export default function TabsLayout() {
  const settings = useSettings();
  const c = useColors();
  if (!settings) return null;
  if (!settings.onboarded) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: c.bg },
        headerShadowVisible: false,
        headerTitleAlign: 'left',
        headerTitleStyle: { color: c.ink, fontFamily: fonts.extrabold, fontSize: 24, letterSpacing: -0.4 },
        sceneStyle: { backgroundColor: c.bg },
      }}>
      {/* The dashboard draws its own header with the logo. */}
      <Tabs.Screen name="index" options={{ title: 'Dashboard', headerShown: false }} />
      <Tabs.Screen name="ai" options={{ title: 'AI mode' }} />
      <Tabs.Screen name="tracker" options={{ title: 'Tracker' }} />
      <Tabs.Screen name="history" options={{ title: 'History' }} />
    </Tabs>
  );
}
