// Design-system primitives shared by every screen.
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';

import { LogoMark } from './brand';
import { elevation, fonts, radius, space, type as typeScale, useColors, useIsDark, type Weight } from '@/theme/tokens';

export type IconName = ComponentProps<typeof Ionicons>['name'];

type TextVariant = keyof typeof typeScale;

export function AppText({
  variant = 'body',
  weight,
  color,
  muted,
  center,
  style,
  ...rest
}: TextProps & { variant?: TextVariant; weight?: Weight; color?: string; muted?: boolean; center?: boolean }) {
  const c = useColors();
  return (
    <Text
      style={[
        typeScale[variant],
        weight && { fontFamily: fonts[weight] },
        { color: color ?? (muted ? c.inkMuted : c.ink) },
        center && { textAlign: 'center' },
        style,
      ]}
      {...rest}
    />
  );
}

type HapticKind = 'light' | 'select' | 'success' | 'warning';

export function haptic(kind: HapticKind = 'light'): void {
  if (Platform.OS === 'web') return;
  if (kind === 'select') Haptics.selectionAsync();
  else if (kind === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  else if (kind === 'warning') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/** A Pressable that dips slightly while pressed, with optional haptic feedback. */
export function PressableScale({
  style,
  haptics,
  onPress,
  children,
  ...rest
}: Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle>; haptics?: HapticKind; children?: ReactNode }) {
  return (
    <Pressable
      {...rest}
      onPress={(e) => {
        if (haptics) haptic(haptics);
        onPress?.(e);
      }}
      style={({ pressed }) => [style, pressed && { transform: [{ scale: 0.975 }], opacity: 0.94 }]}>
      {children}
    </Pressable>
  );
}

export function Screen({
  children,
  scroll = true,
  contentStyle,
}: {
  children: ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  if (!scroll) return <View style={[styles.screen, { flex: 1, backgroundColor: c.bg }, contentStyle]}>{children}</View>;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={[styles.screen, contentStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  const dark = useIsDark();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: c.surface },
        dark ? { borderWidth: StyleSheet.hairlineWidth, borderColor: c.border } : elevation(false),
        style,
      ]}>
      {children}
    </View>
  );
}

/** Evergreen gradient card (the app icon's colours) for the one most important thing on a screen. */
export function HeroCard({ children, style, watermark = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; watermark?: boolean }) {
  const c = useColors();
  return (
    <LinearGradient
      colors={[c.heroTop, c.heroBottom]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.35, y: 1 }}
      style={[styles.hero, elevation(useIsDark(), 2), style]}>
      {watermark && (
        <View pointerEvents="none" style={styles.watermark}>
          <LogoMark size={190} variant="dark" opacity={0.13} />
        </View>
      )}
      {children}
    </LinearGradient>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: { label: string; onPress: () => void } }) {
  const c = useColors();
  return (
    <View style={styles.sectionTitle}>
      <AppText variant="title">{children}</AppText>
      {action && (
        <Pressable onPress={action.onPress} hitSlop={10} accessibilityRole="button">
          <AppText variant="caption" weight="bold" color={c.primary}>
            {action.label}
          </AppText>
        </Pressable>
      )}
    </View>
  );
}

type ButtonKind = 'primary' | 'secondary' | 'ghost' | 'danger' | 'hero' | 'heroGhost';

export function Button({
  title,
  onPress,
  kind = 'primary',
  icon,
  loading,
  disabled,
  style,
  accessibilityLabel,
}: {
  title: string;
  onPress: () => void;
  kind?: ButtonKind;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const c = useColors();
  const bg = {
    primary: c.primary,
    secondary: c.primarySoft,
    ghost: 'transparent',
    danger: c.dangerSoft,
    hero: c.gold,
    heroGhost: 'rgba(246,244,238,0.14)',
  }[kind];
  const fg = {
    primary: c.onPrimary,
    secondary: c.primary,
    ghost: c.primary,
    danger: c.danger,
    hero: c.heroBottom,
    heroGhost: c.onHero,
  }[kind];
  const inactive = disabled || loading;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      onPress={onPress}
      disabled={inactive}
      haptics="light"
      style={[styles.button, { backgroundColor: bg, opacity: inactive ? 0.55 : 1 }, style]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={19} color={fg} />}
          <AppText weight="bold" color={fg}>
            {title}
          </AppText>
        </>
      )}
    </PressableScale>
  );
}

export function IconButton({ icon, onPress, label, size = 40 }: { icon: IconName; onPress: () => void; label: string; size?: number }) {
  const c = useColors();
  const dark = useIsDark();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      haptics="light"
      style={[
        { width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface },
        dark ? { borderWidth: StyleSheet.hairlineWidth, borderColor: c.border } : elevation(false),
      ]}>
      <Ionicons name={icon} size={size * 0.5} color={c.ink} />
    </PressableScale>
  );
}

export function IconCircle({ icon, size = 40, bg, color }: { icon: IconName; size?: number; bg?: string; color?: string }) {
  const c = useColors();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: bg ?? c.primarySoft }}>
      <Ionicons name={icon} size={size * 0.5} color={color ?? c.primary} />
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
  color,
  locked,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  color?: string;
  locked?: boolean;
}) {
  const c = useColors();
  const accent = color ?? c.primary;
  const fg = selected ? c.onPrimary : c.ink;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      haptics="select"
      style={[
        styles.chip,
        { backgroundColor: selected ? accent : c.surface, borderColor: selected ? accent : c.border },
      ]}>
      {icon && <Ionicons name={icon} size={15} color={selected ? c.onPrimary : c.inkMuted} />}
      <AppText variant="caption" weight="semibold" color={fg}>
        {label}
      </AppText>
      {locked && <Ionicons name="lock-closed" size={12} color={selected ? c.onPrimary : c.pro} />}
    </PressableScale>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  locked = [],
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  locked?: T[];
}) {
  const c = useColors();
  const dark = useIsDark();
  return (
    <View style={[styles.segmented, { backgroundColor: c.surfaceAlt }]} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => {
              if (!active) haptic('select');
              onChange(o.value);
            }}
            style={[styles.segment, active && [{ backgroundColor: c.surface }, dark ? null : elevation(false)]]}>
            <AppText variant="caption" weight={active ? 'bold' : 'semibold'} color={active ? c.ink : c.inkMuted}>
              {o.label}
            </AppText>
            {locked.includes(o.value) && <Ionicons name="lock-closed" size={11} color={c.pro} />}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Brand-coloured switch. react-native-web colours the "on" thumb with its own prop. */
export function Toggle({
  value,
  onValueChange,
  label,
  disabled,
}: {
  value: boolean;
  onValueChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  const c = useColors();
  const web = Platform.OS === 'web' ? ({ activeThumbColor: '#FFFFFF' } as object) : null;
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ true: c.primary, false: c.border }}
      thumbColor="#FFFFFF"
      ios_backgroundColor={c.border}
      accessibilityLabel={label}
      {...web}
    />
  );
}

export function Field({
  label,
  hint,
  icon,
  style,
  onFocus,
  onBlur,
  ...rest
}: TextInputProps & { label?: string; hint?: string; icon?: IconName }) {
  const c = useColors();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      {label && (
        <AppText variant="caption" weight="semibold" muted>
          {label}
        </AppText>
      )}
      <View style={[styles.inputWrap, { backgroundColor: c.surface, borderColor: focused ? c.primary : c.border }]}>
        {icon && <Ionicons name={icon} size={18} color={c.inkMuted} />}
        <TextInput
          placeholderTextColor={c.inkMuted}
          style={[styles.input, { color: c.ink }, style]}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
      </View>
      {hint && (
        <AppText variant="caption" muted>
          {hint}
        </AppText>
      )}
    </View>
  );
}

export function Banner({ tone = 'info', icon, children }: { tone?: 'info' | 'warn' | 'danger' | 'success'; icon?: IconName; children: ReactNode }) {
  const c = useColors();
  const map = {
    info: { bg: c.primarySoft, fg: c.primary, icon: 'information-circle' as IconName },
    success: { bg: c.needSoft, fg: c.needInk, icon: 'checkmark-circle' as IconName },
    warn: { bg: c.wantSoft, fg: c.wantInk, icon: 'alert-circle' as IconName },
    danger: { bg: c.dangerSoft, fg: c.danger, icon: 'alert-circle' as IconName },
  }[tone];
  return (
    <View style={[styles.banner, { backgroundColor: map.bg }]}>
      <Ionicons name={icon ?? map.icon} size={20} color={map.fg} />
      <AppText variant="caption" weight="semibold" style={{ flex: 1 }}>
        {children}
      </AppText>
    </View>
  );
}

export function ProBadge({ label = 'PRO', onHero }: { label?: string; onHero?: boolean }) {
  const c = useColors();
  return (
    <View style={[styles.proBadge, { backgroundColor: onHero ? c.gold : c.wantSoft }]}>
      <Ionicons name="sparkles" size={11} color={onHero ? c.heroBottom : c.pro} />
      <AppText variant="caption" weight="extrabold" color={onHero ? c.heroBottom : c.pro} style={{ fontSize: 11, lineHeight: 14 }}>
        {label}
      </AppText>
    </View>
  );
}

export function Pill({ icon, label, color, bg }: { icon?: IconName; label: string; color: string; bg: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      {icon && <Ionicons name={icon} size={14} color={color} />}
      <AppText variant="caption" weight="bold" color={color}>
        {label}
      </AppText>
    </View>
  );
}

export function EmptyState({
  illustration,
  title,
  body,
  action,
}: {
  illustration?: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.empty}>
      {illustration}
      <AppText variant="title" center>
        {title}
      </AppText>
      <AppText muted center>
        {body}
      </AppText>
      {action}
    </View>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: space.sm }, style]}>{children}</View>;
}

export function Divider() {
  const c = useColors();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border }} />;
}

/** A settings-style row: icon, title, optional subtitle, and a trailing accessory or chevron. */
export function ListRow({
  icon,
  tint,
  title,
  subtitle,
  right,
  onPress,
  destructive,
}: {
  icon: IconName;
  tint?: { bg: string; fg: string };
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  destructive?: boolean;
}) {
  const c = useColors();
  const content = (
    <View style={styles.listRow}>
      <IconCircle icon={icon} size={36} bg={tint?.bg ?? (destructive ? c.dangerSoft : c.primarySoft)} color={tint?.fg ?? (destructive ? c.danger : c.primary)} />
      <View style={{ flex: 1, gap: 1 }}>
        <AppText weight="semibold" color={destructive ? c.danger : c.ink}>
          {title}
        </AppText>
        {subtitle && (
          <AppText variant="caption" muted>
            {subtitle}
          </AppText>
        )}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={c.inkMuted} /> : null)}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { padding: space.lg, gap: space.lg, paddingBottom: 120, flexGrow: 1 },
  card: { borderRadius: radius.lg, padding: space.lg + 2, gap: space.md },
  hero: { borderRadius: radius.lg, padding: space.xl, gap: space.md, overflow: 'hidden' },
  watermark: { position: 'absolute', right: -40, bottom: -46, transform: [{ rotate: '8deg' }] },
  sectionTitle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.xs },
  button: {
    minHeight: 52,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    minHeight: 38,
  },
  segmented: { flexDirection: 'row', borderRadius: radius.pill, padding: 4 },
  segment: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: radius.pill,
    minHeight: 38,
  },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 14 },
  input: { flex: 1, minWidth: 0, minHeight: 50, fontSize: 16, fontFamily: fonts.medium, outlineStyle: 'solid', outlineWidth: 0 },
  banner: { flexDirection: 'row', gap: space.sm, alignItems: 'center', borderRadius: 14, padding: space.md },
  proBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  empty: { alignItems: 'center', gap: space.md, paddingVertical: space.lg, paddingHorizontal: space.lg },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm + 2 },
});
