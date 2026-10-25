import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Logo } from './brand';
import { Scribble, SketchCircle, SketchRule } from './sketch';
import { AppText, haptic } from './ui';
import { useSettings } from '@/db/settings';
import { useSync } from '@/db/SyncProvider';
import { useAuth } from '@/lib/auth';
import { usePro } from '@/lib/pro';
import { colors, fonts, useWide } from '@/theme/tokens';

// Drawn on a 24 × 24 grid with round ink strokes, like the rest of the sketchbook.
export const TAB_ICONS: Record<string, string> = {
  index: 'M4 20.5h16 M6.5 20V13 M12 20V6 M17.5 20v-9',
  ai: 'M12 3.5c.7 4.3 2.4 6.1 6.5 6.9-4.1.8-5.8 2.6-6.5 6.9-.7-4.3-2.4-6.1-6.5-6.9 4.1-.8 5.8-2.6 6.5-6.9z M19 15.5l.5 2 2 .5-2 .5-.5 2-.5-2-2-.5 2-.5z',
  tracker: 'M4.5 19.5l1.2-4.4L15.6 5.2a1.9 1.9 0 0 1 2.7 0l.5.5a1.9 1.9 0 0 1 0 2.7L8.9 18.3z M14 6.8l3.2 3.2',
  history: 'M9 6.5h11 M9 12h11 M9 17.5h11 M4 5.5h2.5v2.5H4z M4 11h2.5v2.5H4z M4 16.5h2.5v2.5H4z',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M12 3v2.5 M12 18.5V21 M3 12h2.5 M18.5 12H21 M5.6 5.6l1.8 1.8 M16.6 16.6l1.8 1.8 M5.6 18.4l1.8-1.8 M16.6 7.4l1.8-1.8',
};

export function TabIcon({ name, color, size = 26 }: { name: string; color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={TAB_ICONS[name] ?? TAB_ICONS.index} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Bottom tabs on phones; on iPad and Mac the same tabs become a sidebar (see the tabs layout). */
export function TabBar(props: BottomTabBarProps) {
  return useWide() ? <SideBar {...props} /> : <BottomBar {...props} />;
}

function useTabs({ state, descriptors, emitter, navigateToTab }: BottomTabBarProps) {
  return state.routes.map((route, index) => {
    const focused = index === state.index;
    const label = descriptors[route.key]?.options.title ?? route.name;
    const onPress = () => {
      const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) {
        haptic('select');
        navigateToTab(route.key);
      }
    };
    return { key: route.key, name: route.name, label, focused, onPress, onLongPress: () => emitter.emit({ type: 'tabLongPress', target: route.key }) };
  });
}

function BottomBar(props: BottomTabBarProps) {
  const tabs = useTabs(props);
  return (
    <View accessibilityRole="tablist" style={[styles.bar, { paddingBottom: Math.max(props.insets.bottom, 10) }]}>
      <SketchRule seed={3} opacity={0.35} style={styles.barRule} />
      {tabs.map((t) => (
        <Pressable
          key={t.key}
          accessibilityRole="tab"
          accessibilityLabel={t.label}
          accessibilityState={{ selected: t.focused }}
          onPress={t.onPress}
          onLongPress={t.onLongPress}
          style={styles.item}>
          <TabIcon name={t.name} color={t.focused ? colors.ink : colors.pencil} />
          <Text numberOfLines={1} style={[styles.label, { color: t.focused ? colors.ink : colors.pencil, fontFamily: t.focused ? fonts.semibold : fonts.medium }]}>
            {t.label}
          </Text>
          <View style={{ height: 6, opacity: t.focused ? 1 : 0 }}>
            <Scribble width={20} />
          </View>
        </Pressable>
      ))}
    </View>
  );
}

function SideBar(props: BottomTabBarProps) {
  const tabs = useTabs(props);
  const { user } = useAuth();
  const settings = useSettings();
  const { status } = useSync();
  const { isPro } = usePro();
  const name = settings?.name || user?.name || user?.email?.split('@')[0] || 'You';
  const where = status === 'local' ? 'on this device' : status === 'offline' ? 'offline' : 'synced';
  return (
    <View accessibilityRole="tablist" style={[styles.side, { paddingTop: props.insets.top + 36, paddingBottom: Math.max(props.insets.bottom, 24) }]}>
      <View style={styles.sideRule}>
        <SideRule />
      </View>
      <View style={{ paddingHorizontal: 8 }}>
        <Logo size={26} />
      </View>
      <View style={{ gap: 4, marginTop: 36 }}>
        {tabs.map((t) => (
          <SideItem key={t.key} icon={t.name} label={t.label} focused={t.focused} onPress={t.onPress} role="tab" />
        ))}
        <SideItem icon="settings" label="Settings" focused={false} onPress={() => router.push('/settings')} role="button" />
      </View>
      <Pressable
        onPress={() => router.push('/settings')}
        accessibilityRole="button"
        accessibilityLabel="Account and settings"
        style={({ pressed }) => [styles.account, { opacity: pressed ? 0.6 : 1 }]}>
        <SketchCircle size={36} seed={83}>
          <Text style={{ fontFamily: fonts.serif, fontSize: 20, color: colors.ink }}>{name.slice(0, 1).toUpperCase()}</Text>
        </SketchCircle>
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText weight="semibold" numberOfLines={1} style={{ fontSize: 14 }}>
            {name}
          </AppText>
          <AppText variant="caption" faint style={{ fontSize: 12 }}>
            {isPro ? `Pro · ${where}` : where.charAt(0).toUpperCase() + where.slice(1)}
          </AppText>
        </View>
      </Pressable>
    </View>
  );
}

function SideItem({ icon, label, focused, onPress, role }: { icon: string; label: string; focused: boolean; onPress: () => void; role: 'tab' | 'button' }) {
  const [w, setW] = useState(0);
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={role === 'tab' ? { selected: focused } : undefined}
      onPress={onPress}
      style={({ pressed }) => [styles.sideItem, { opacity: pressed ? 0.6 : 1 }]}>
      <TabIcon name={icon} size={22} color={focused ? colors.ink : colors.graphite} />
      <View>
        <Text
          onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))}
          style={{ fontFamily: focused ? fonts.semibold : fonts.medium, fontSize: 15, color: focused ? colors.ink : colors.graphite }}>
          {label}
        </Text>
        {focused && w > 0 && <Scribble width={w} style={{ position: 'absolute', bottom: -9 }} />}
      </View>
    </Pressable>
  );
}

/** The sidebar's right edge: a long vertical pencil line. */
function SideRule() {
  return (
    <Svg width={6} height="100%" viewBox="0 0 6 100" preserveAspectRatio="none">
      <Path d="M3 0 Q 4.4 50 2.6 100" stroke={colors.ink} strokeWidth={1} fill="none" opacity={0.3} vectorEffect="non-scaling-stroke" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', paddingTop: 10, paddingHorizontal: 12, backgroundColor: colors.paper },
  barRule: { position: 'absolute', left: 0, right: 0, top: -2 },
  item: { flex: 1, alignItems: 'center', gap: 3, minHeight: 48 },
  label: { fontSize: 11, lineHeight: 14 },
  side: { width: 232, paddingHorizontal: 24, backgroundColor: colors.paper },
  sideRule: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 6 },
  sideItem: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 44, paddingHorizontal: 8 },
  account: { marginTop: 'auto', flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8 },
});
