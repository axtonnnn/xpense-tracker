import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Logo } from './brand';
import { Icon, type IconName } from './icons';
import { timing, useMotion } from './motion';
import { AppText, Avatar, haptic } from './ui';
import { useSettings } from '@/db/settings';
import { useSync } from '@/db/SyncProvider';
import { useAuth } from '@/lib/auth';
import { usePro } from '@/lib/pro';
import { colors, fonts, motion, useWide } from '@/theme/tokens';

const TAB_ICONS: Record<string, IconName> = { index: 'dashboard', ai: 'ai', tracker: 'tracker', history: 'history', savings: 'goal' };
/** Tabs that only show in the iPad and Mac sidebar. */
const SIDEBAR_ONLY = ['savings'];

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
        haptic('light');
        navigateToTab(route.key);
      }
    };
    return {
      key: route.key,
      name: route.name,
      icon: TAB_ICONS[route.name] ?? 'dashboard',
      label,
      focused,
      onPress,
      onLongPress: () => emitter.emit({ type: 'tabLongPress', target: route.key }),
    };
  });
}

/**
 * An icon that fills in and lifts 2 px when its tab is chosen (180 ms): the outline fades out as the
 * filled one fades in.
 */
function NavIcon({ name, focused, size, ground }: { name: IconName; focused: boolean; size: number; ground: string }) {
  const moving = useMotion();
  const p = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    p.set(withTiming(focused ? 1 : 0, timing(moving ? motion.small : 1)));
  }, [focused, moving, p]);
  const lift = useAnimatedStyle(() => ({ transform: [{ translateY: moving ? -2 * p.value : 0 }] }));
  const on = useAnimatedStyle(() => ({ opacity: p.value }));
  const off = useAnimatedStyle(() => ({ opacity: 1 - p.value }));
  return (
    <Animated.View style={[{ width: size, height: size }, lift]}>
      <Animated.View style={[StyleSheet.absoluteFill, off]}>
        <Icon name={name} size={size} color={colors.grey} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, on]}>
        <Icon name={name} size={size} color={colors.ink} filled ground={ground} />
      </Animated.View>
    </Animated.View>
  );
}

function BottomBar(props: BottomTabBarProps) {
  const tabs = useTabs(props).filter((t) => !SIDEBAR_ONLY.includes(t.name));
  return (
    <View accessibilityRole="tablist" style={[styles.bar, { paddingBottom: Math.max(props.insets.bottom - 4, 12) }]}>
      {tabs.map((t) => (
        <Pressable
          key={t.key}
          accessibilityRole="tab"
          accessibilityLabel={t.label}
          accessibilityState={{ selected: t.focused }}
          onPress={t.onPress}
          onLongPress={t.onLongPress}
          style={styles.item}>
          <NavIcon name={t.icon} focused={t.focused} size={22} ground={colors.paper} />
          <Text numberOfLines={1} style={[styles.label, { color: t.focused ? colors.ink : colors.grey, fontFamily: t.focused ? fonts.medium : fonts.regular }]}>
            {t.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const SIDE_ITEM = 44;
const SIDE_GAP = 2;

function SideBar(props: BottomTabBarProps) {
  const tabs = useTabs(props);
  const moving = useMotion();
  const { user } = useAuth();
  const settings = useSettings();
  const { status, lastSyncedAt } = useSync();
  const { isPro } = usePro();
  const name = settings?.name || user?.name || user?.email?.split('@')[0] || 'You';
  const synced =
    status === 'local' ? 'On this device' : status === 'offline' ? 'Offline' : lastSyncedAt ? `Synced ${sinceText(lastSyncedAt)}` : 'Syncing…';
  const selected = tabs.findIndex((t) => t.focused);

  // The white plate slides to the chosen item.
  const y = useSharedValue(selected * (SIDE_ITEM + SIDE_GAP));
  useEffect(() => {
    const to = selected * (SIDE_ITEM + SIDE_GAP);
    y.set(moving ? withTiming(to, timing(motion.small)) : to);
  }, [selected, moving, y]);
  const plate = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  return (
    <View accessibilityRole="tablist" style={[styles.side, { paddingTop: props.insets.top + 32, paddingBottom: Math.max(props.insets.bottom, 24) }]}>
      <View style={{ paddingHorizontal: 8 }}>
        <Logo size={22} />
      </View>
      <View style={{ gap: SIDE_GAP, marginTop: 36 }}>
        {selected >= 0 && <Animated.View pointerEvents="none" style={[styles.plate, plate]} />}
        {tabs.map((t) => (
          <SideItem key={t.key} icon={t.icon} label={t.label} focused={t.focused} onPress={t.onPress} role="tab" />
        ))}
      </View>
      <View style={{ marginTop: 'auto', gap: SIDE_GAP }}>
        <SideItem icon="settings" label="Settings" focused={false} onPress={() => router.push('/settings')} role="button" />
        <Pressable
          onPress={() => router.push('/settings')}
          accessibilityRole="button"
          accessibilityLabel={`${name}, ${isPro ? 'Pro, ' : ''}${synced}. Account and settings`}
          style={({ pressed }) => [styles.account, { opacity: pressed ? 0.6 : 1 }]}>
          <Avatar name={name} size={36} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText weight="medium" numberOfLines={1} style={{ fontSize: 14, lineHeight: 18 }}>
              {name}
            </AppText>
            <AppText variant="small" muted numberOfLines={1}>
              {isPro ? `Pro · ${synced.charAt(0).toLowerCase()}${synced.slice(1)}` : synced}
            </AppText>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

function SideItem({ icon, label, focused, onPress, role }: { icon: IconName; label: string; focused: boolean; onPress: () => void; role: 'tab' | 'button' }) {
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={role === 'tab' ? { selected: focused } : undefined}
      onPress={onPress}
      style={({ pressed }) => [styles.sideItem, { opacity: pressed ? 0.6 : 1 }]}>
      <NavIcon name={icon} focused={focused} size={20} ground={colors.page} />
      <Text style={{ fontFamily: focused ? fonts.medium : fonts.regular, fontSize: 15, color: focused ? colors.ink : colors.grey }}>{label}</Text>
    </Pressable>
  );
}

/** "just now", "2 min ago", "at 9:41". */
export function sinceText(at: Date): string {
  const mins = Math.floor((Date.now() - at.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  return `at ${at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    paddingTop: 8,
    backgroundColor: colors.paper,
    borderTopWidth: 1,
    borderTopColor: colors.rule,
  },
  item: { flex: 1, alignItems: 'center', gap: 5, paddingVertical: 6, minHeight: 48 },
  label: { fontSize: 11, lineHeight: 14 },
  side: { width: 240, paddingHorizontal: 20, backgroundColor: colors.paper, borderRightWidth: 1, borderRightColor: colors.rule },
  plate: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: SIDE_ITEM,
    backgroundColor: colors.page,
    borderWidth: 1,
    borderColor: colors.rule,
  },
  sideItem: { flexDirection: 'row', alignItems: 'center', gap: 12, height: SIDE_ITEM, paddingHorizontal: 8 },
  account: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    paddingTop: 14,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: colors.rule,
  },
});
