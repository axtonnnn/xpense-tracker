import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { Pressable } from 'react-native';

import { useSettings } from '@/db/settings';
import { useColors } from '@/theme/tokens';

export default function TabsLayout() {
  const settings = useSettings();
  const c = useColors();
  if (!settings) return null;
  if (!settings.onboarded) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.inkMuted,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border },
        headerStyle: { backgroundColor: c.bg },
        headerShadowVisible: false,
        headerTitleStyle: { color: c.ink, fontWeight: '700' },
        sceneStyle: { backgroundColor: c.bg },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <Ionicons name="stats-chart" size={size} color={color as string} />,
          headerRight: () => (
            <Link href="/settings" asChild>
              <Pressable accessibilityLabel="Settings" hitSlop={10} style={{ marginRight: 16 }}>
                <Ionicons name="settings-outline" size={22} color={c.ink} />
              </Pressable>
            </Link>
          ),
        }}
      />
      <Tabs.Screen
        name="ai"
        options={{
          title: 'AI mode',
          tabBarIcon: ({ color, size }) => <Ionicons name="sparkles" size={size} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="tracker"
        options={{
          title: 'Tracker',
          tabBarIcon: ({ color, size }) => <Ionicons name="add-circle" size={size} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, size }) => <Ionicons name="list" size={size} color={color as string} />,
        }}
      />
    </Tabs>
  );
}
