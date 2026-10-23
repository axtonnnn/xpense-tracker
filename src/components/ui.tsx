// Small design-system primitives shared by every screen.
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';

import { radius, space, type as typeScale, useColors } from '@/theme/tokens';

export type IconName = ComponentProps<typeof Ionicons>['name'];

type TextVariant = keyof typeof typeScale;

export function AppText({
  variant = 'body',
  color,
  muted,
  style,
  ...rest
}: TextProps & { variant?: TextVariant; color?: string; muted?: boolean }) {
  const c = useColors();
  return <Text style={[typeScale[variant], { color: color ?? (muted ? c.inkMuted : c.ink) }, style]} {...rest} />;
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
  if (!scroll) return <View style={[styles.screen, { backgroundColor: c.bg }, contentStyle]}>{children}</View>;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={[styles.screen, contentStyle]}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      contentInsetAdjustmentBehavior="automatic">
      {children}
    </ScrollView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }, style]}>{children}</View>;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.sectionTitle}>
      <AppText variant="title">{children}</AppText>
      {right}
    </View>
  );
}

type ButtonKind = 'primary' | 'secondary' | 'ghost' | 'danger';

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
  const bg = { primary: c.primary, secondary: c.surfaceAlt, ghost: 'transparent', danger: 'transparent' }[kind];
  const fg = { primary: c.onPrimary, secondary: c.ink, ghost: c.primary, danger: c.danger }[kind];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: inactive ? 0.5 : pressed ? 0.85 : 1 },
        kind === 'danger' && { borderWidth: 1, borderColor: c.danger },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={20} color={fg} />}
          <AppText color={fg} style={{ fontWeight: '700' }}>
            {title}
          </AppText>
        </>
      )}
    </Pressable>
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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? accent : c.surface,
          borderColor: selected ? accent : c.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}>
      {icon && <Ionicons name={icon} size={15} color={selected ? c.onPrimary : c.inkMuted} />}
      <AppText variant="caption" color={selected ? c.onPrimary : c.ink}>
        {label}
      </AppText>
      {locked && <Ionicons name="lock-closed" size={12} color={selected ? c.onPrimary : c.pro} />}
    </Pressable>
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
  return (
    <View style={[styles.segmented, { backgroundColor: c.surfaceAlt }]} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, active && { backgroundColor: c.surface }]}>
            <AppText variant="caption" color={active ? c.ink : c.inkMuted} style={{ fontWeight: active ? '700' : '500' }}>
              {o.label}
            </AppText>
            {locked.includes(o.value) && <Ionicons name="lock-closed" size={11} color={c.pro} />}
          </Pressable>
        );
      })}
    </View>
  );
}

export function Field({ label, hint, style, ...rest }: TextInputProps & { label?: string; hint?: string }) {
  const c = useColors();
  return (
    <View style={{ gap: space.xs }}>
      {label && (
        <AppText variant="caption" muted>
          {label}
        </AppText>
      )}
      <TextInput
        placeholderTextColor={c.inkMuted}
        style={[styles.input, { backgroundColor: c.surface, borderColor: c.border, color: c.ink }, style]}
        {...rest}
      />
      {hint && (
        <AppText variant="caption" muted>
          {hint}
        </AppText>
      )}
    </View>
  );
}

export function Banner({ tone = 'info', icon, children }: { tone?: 'info' | 'warn' | 'danger'; icon?: IconName; children: ReactNode }) {
  const c = useColors();
  const color = { info: c.primary, warn: c.want, danger: c.danger }[tone];
  return (
    <View style={[styles.banner, { borderColor: color, backgroundColor: c.surface }]}>
      <Ionicons name={icon ?? (tone === 'info' ? 'information-circle' : 'alert-circle')} size={20} color={color} />
      <AppText variant="caption" style={{ flex: 1 }}>
        {children}
      </AppText>
    </View>
  );
}

export function ProBadge({ label = 'PRO' }: { label?: string }) {
  const c = useColors();
  return (
    <View style={[styles.proBadge, { borderColor: c.pro }]}>
      <Ionicons name="sparkles" size={11} color={c.pro} />
      <AppText variant="caption" color={c.pro} style={{ fontSize: 11, fontWeight: '800' }}>
        {label}
      </AppText>
    </View>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: IconName; title: string; body: string; action?: ReactNode }) {
  const c = useColors();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: c.surfaceAlt }]}>
        <Ionicons name={icon} size={28} color={c.primary} />
      </View>
      <AppText variant="title" style={{ textAlign: 'center' }}>
        {title}
      </AppText>
      <AppText muted style={{ textAlign: 'center' }}>
        {body}
      </AppText>
      {action}
    </View>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: space.sm }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl * 2, flexGrow: 1 },
  card: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: space.lg, gap: space.md },
  sectionTitle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  button: {
    minHeight: 50,
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
    gap: space.xs,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    minHeight: 36,
  },
  segmented: { flexDirection: 'row', borderRadius: radius.sm, padding: 3 },
  segment: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.sm,
    borderRadius: radius.sm - 2,
    minHeight: 36,
  },
  input: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: space.md, minHeight: 48, fontSize: 16 },
  banner: { flexDirection: 'row', gap: space.sm, alignItems: 'center', borderWidth: 1, borderRadius: radius.sm, padding: space.md },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  empty: { alignItems: 'center', gap: space.md, paddingVertical: space.xl, paddingHorizontal: space.lg },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
});
