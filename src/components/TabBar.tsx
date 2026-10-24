import Ionicons from '@expo/vector-icons/Ionicons';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, haptic, type IconName } from './ui';
import { radius, useColors, useIsDark } from '@/theme/tokens';

const ICONS: Record<string, [outline: IconName, filled: IconName]> = {
  index: ['stats-chart-outline', 'stats-chart'],
  ai: ['sparkles-outline', 'sparkles'],
  tracker: ['add-circle-outline', 'add-circle'],
  history: ['receipt-outline', 'receipt'],
};

/** Bottom tabs: filled icon in a soft evergreen pill for the active tab. */
export function TabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const c = useColors();
  const dark = useIsDark();
  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.bar,
        { backgroundColor: c.surface, borderTopColor: c.border, paddingBottom: Math.max(insets.bottom, 10) },
        !dark && styles.shadow,
      ]}>
      {state.routes.map((route, index) => {
        const focused = index === state.index;
        const label = descriptors[route.key]?.options.title ?? route.name;
        const [outline, filled] = ICONS[route.name] ?? ['ellipse-outline', 'ellipse'];
        const onPress = () => {
          const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            haptic('select');
            navigateToTab(route.key);
          }
        };
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: focused }}
            onPress={onPress}
            onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })}
            style={styles.item}>
            <View style={[styles.iconPill, focused && { backgroundColor: c.primarySoft }]}>
              <Ionicons name={focused ? filled : outline} size={22} color={focused ? c.primary : c.inkMuted} />
            </View>
            <AppText
              variant="caption"
              weight={focused ? 'bold' : 'semibold'}
              color={focused ? c.primary : c.inkMuted}
              style={styles.label}
              numberOfLines={1}>
              {label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, paddingHorizontal: 8 },
  shadow: { shadowColor: '#1B2421', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: -2 }, elevation: 8 },
  item: { flex: 1, alignItems: 'center', gap: 3, minHeight: 48 },
  iconPill: { width: 56, height: 30, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 11, lineHeight: 14 },
});
