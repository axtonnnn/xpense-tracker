import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';

import { TabBar } from '@/components/TabBar';
import { useSettings } from '@/db/settings';
import { colors, useWide } from '@/theme/tokens';

export default function TabsLayout() {
  const settings = useSettings();
  const wide = useWide();
  if (!settings) return null;
  if (!settings.onboarded) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        // Every tab draws its own serif title; on iPad and Mac the tabs become a sidebar.
        headerShown: false,
        tabBarPosition: wide ? 'left' : 'bottom',
        sceneStyle: { backgroundColor: colors.paper },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Dashboard' }} />
      <Tabs.Screen name="ai" options={{ title: 'AI mode' }} />
      <Tabs.Screen name="tracker" options={{ title: 'Tracker' }} />
      <Tabs.Screen name="history" options={{ title: 'History' }} />
      {/* iPad and Mac only: the sidebar's savings goal. Phones open the goal as its own screen. */}
      <Tabs.Screen name="savings" options={{ title: 'Savings goal' }} />
    </Tabs>
  );
}
