// Design-system primitives shared by every screen: paper, white pages with sketched frames, ink buttons,
// underlined fields and serif headings. See docs/brand/README.md for the rules behind them.
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useId, useState, type ComponentProps, type ReactNode } from 'react';
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
  type LayoutChangeEvent,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PageFill, Scribble, seedOf, SketchFrame, SketchRule } from './sketch';
import { colors, fonts, READABLE_MAX, space, type as typeScale } from '@/theme/tokens';

export type IconName = ComponentProps<typeof Ionicons>['name'];

type TextVariant = keyof typeof typeScale;
type Weight = 'regular' | 'medium' | 'semibold';

export function AppText({
  variant = 'body',
  weight,
  color,
  muted,
  faint,
  center,
  style,
  ...rest
}: TextProps & { variant?: TextVariant; weight?: Weight; color?: string; muted?: boolean; faint?: boolean; center?: boolean }) {
  return (
    <Text
      style={[
        typeScale[variant],
        weight && { fontFamily: fonts[weight] },
        { color: color ?? (faint ? colors.pencil : muted ? colors.graphite : colors.ink) },
        center && { textAlign: 'center' },
        style,
      ]}
      {...rest}
    />
  );
}

/** Money and counts line up in columns. */
export const tabular = { fontVariant: ['tabular-nums' as const] };

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
      style={({ pressed }) => [style, pressed && { transform: [{ scale: 0.98 }], opacity: 0.85 }]}>
      {children}
    </Pressable>
  );
}

/** A stable seed for this component instance, so its sketched frame keeps the same wobble. */
export function useSeed(seed?: number | string): number {
  const id = useId();
  return typeof seed === 'number' ? seed : seedOf(seed ?? id);
}

/**
 * The paper every screen is drawn on. Content is centred and stops at a readable width on iPad and Mac;
 * pass `full` for screens that lay out their own columns.
 */
export function Screen({
  children,
  scroll = true,
  full,
  topInset,
  contentStyle,
}: {
  children: ReactNode;
  scroll?: boolean;
  full?: boolean;
  /** Pad for the status bar (screens without a navigation header). */
  topInset?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  const inner = [styles.screen, !full && styles.readable, topInset && { paddingTop: insets.top + space.md }, contentStyle];
  if (!scroll) return <View style={[{ flex: 1, backgroundColor: colors.paper }, inner]}>{children}</View>;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.paper }}
      contentContainerStyle={inner}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  );
}

/** A white page with a sketched frame. */
export function Card({ children, style, seed }: { children: ReactNode; style?: StyleProp<ViewStyle>; seed?: number | string }) {
  const s = useSeed(seed);
  return (
    <View style={[styles.card, style]}>
      <PageFill />
      <SketchFrame seed={s} />
      {children}
    </View>
  );
}

/** A screen's heading: an optional pencil note above a serif title, with something on the right. */
export function PageTitle({ title, note, right }: { title: string; note?: string; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space.md }}>
      <View style={{ flexShrink: 1 }}>
        {note && <AppText variant="note" muted>{note}</AppText>}
        <AppText variant="display" accessibilityRole="header">
          {title}
        </AppText>
      </View>
      {right}
    </View>
  );
}

export function SectionTitle({
  children,
  action,
  note,
}: {
  children: ReactNode;
  action?: { label: string; onPress: () => void };
  note?: string;
}) {
  return (
    <View style={styles.sectionTitle}>
      <AppText variant="title" accessibilityRole="header">
        {children}
      </AppText>
      {action ? (
        <TextLink label={action.label} onPress={action.onPress} />
      ) : note ? (
        <AppText variant="note" muted style={{ fontSize: 19 }}>
          {note}
        </AppText>
      ) : null}
    </View>
  );
}

/** Small uppercase label above a group, e.g. "SAFE TO SPEND". */
export function Label({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={style}>
      <AppText variant="label" muted>
        {children}
      </AppText>
    </View>
  );
}

type ButtonKind = 'primary' | 'secondary' | 'ghost' | 'danger';

/** primary: an ink plate. secondary: a sketched outline. ghost: plain text. danger: red text in an outline. */
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
  const seed = useSeed(title);
  const fg = kind === 'primary' ? colors.onInk : kind === 'danger' ? colors.alert : colors.ink;
  const inactive = disabled || loading;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      onPress={onPress}
      disabled={inactive}
      haptics="light"
      style={[styles.button, kind === 'primary' && { backgroundColor: colors.ink }, { opacity: inactive ? 0.5 : 1 }, style]}>
      {(kind === 'secondary' || kind === 'danger') && <SketchFrame seed={seed} opacity={kind === 'danger' ? 0.7 : 1} />}
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={19} color={fg} />}
          <AppText weight="medium" color={fg}>
            {title}
          </AppText>
        </>
      )}
    </PressableScale>
  );
}

/** An underlined text link. */
export function TextLink({ label, onPress, muted }: { label: string; onPress: () => void; muted?: boolean }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="link" style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}>
      <AppText variant="caption" muted={muted} style={{ textDecorationLine: 'underline', fontSize: 14 }}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function IconButton({ icon, onPress, label, size = 40 }: { icon: IconName; onPress: () => void; label: string; size?: number }) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      haptics="light"
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={size * 0.55} color={colors.ink} />
    </PressableScale>
  );
}

/** A choice chip: sketched outline, or an ink plate when picked. */
export function Chip({
  label,
  selected,
  onPress,
  mark,
  locked,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** A need/want mark drawn before the label. */
  mark?: ReactNode;
  locked?: boolean;
}) {
  const seed = useSeed(label);
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={locked ? `${label}, Pro` : label}
      onPress={onPress}
      haptics="select"
      style={[styles.chip, selected && { backgroundColor: colors.ink }]}>
      {!selected && <SketchFrame seed={seed} twice={false} />}
      {mark}
      <AppText variant="caption" weight="medium" color={selected ? colors.onInk : colors.ink} style={{ fontSize: 14 }}>
        {label}
      </AppText>
      {locked && <ProTag light={selected} />}
    </PressableScale>
  );
}

/** "pro", pencilled next to things that need Xpense Pro. */
export function ProTag({ light }: { light?: boolean }) {
  return (
    <AppText variant="note" color={light ? colors.onInk : colors.graphite} style={{ fontSize: 17, lineHeight: 18 }}>
      pro
    </AppText>
  );
}

/** Text tabs with a scribbled underline under the chosen one (periods, expense/income). */
export function TextTabs<T extends string>({
  options,
  value,
  onChange,
  locked = [],
  size = 'sm',
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  locked?: T[];
  size?: 'sm' | 'lg';
}) {
  const [widths, setWidths] = useState<Record<string, number>>({});
  const big = size === 'lg';
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: big ? 26 : 22, rowGap: space.md }} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={locked.includes(o.value) ? `${o.label}, Pro` : o.label}
            hitSlop={8}
            onPress={() => {
              if (!active) haptic('select');
              onChange(o.value);
            }}
            style={{ paddingBottom: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 2 }}>
              <Text
                onLayout={(e: LayoutChangeEvent) => {
                  const w = Math.round(e.nativeEvent.layout.width);
                  if (widths[o.value] !== w) setWidths((cur) => ({ ...cur, [o.value]: w }));
                }}
                style={
                  big
                    ? { fontFamily: fonts.serif, fontSize: 34, lineHeight: 38, color: active ? colors.ink : colors.pencil }
                    : { fontFamily: active ? fonts.semibold : fonts.regular, fontSize: 15, lineHeight: 20, color: active ? colors.ink : colors.graphite }
                }>
                {o.label}
              </Text>
              {locked.includes(o.value) && <ProTag />}
            </View>
            {active && widths[o.value] ? <Scribble width={widths[o.value]} style={{ position: 'absolute', bottom: big ? -4 : 0 }} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Ink switch. react-native-web colours the "on" thumb with its own prop. */
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
  const web = Platform.OS === 'web' ? ({ activeThumbColor: '#FFFFFF' } as object) : null;
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ true: colors.ink, false: colors.sand }}
      thumbColor="#FFFFFF"
      ios_backgroundColor={colors.sand}
      accessibilityLabel={label}
      {...web}
    />
  );
}

/** A field is a label and an ink underline, like writing on a line. */
export function Field({
  label,
  hint,
  right,
  big,
  style,
  onFocus,
  onBlur,
  ...rest
}: TextInputProps & { label?: string; hint?: string; right?: ReactNode; big?: boolean }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 4 }}>
      {label && (
        <AppText variant="caption" muted>
          {label}
        </AppText>
      )}
      <View style={[styles.inputWrap, { borderBottomColor: colors.ink, borderBottomWidth: focused ? 2 : 1.4 }]}>
        <TextInput
          placeholderTextColor={colors.pencil}
          style={[styles.input, big && { fontFamily: fonts.serif, fontSize: 30 }, { color: colors.ink }, style]}
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
        {right}
      </View>
      {hint && (
        <AppText variant="caption" faint>
          {hint}
        </AppText>
      )}
    </View>
  );
}

/** A short message in a sketched box. Danger text is the only red in the app. */
export function Banner({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'danger' | 'success'; children: ReactNode }) {
  const seed = useSeed();
  const danger = tone === 'danger';
  return (
    <View style={styles.banner} accessibilityRole={danger ? 'alert' : undefined}>
      <PageFill color={danger ? colors.alertSoft : colors.page} />
      <SketchFrame seed={seed} twice={false} opacity={danger ? 0.6 : 0.8} />
      <Ionicons
        name={danger ? 'alert-circle-outline' : tone === 'success' ? 'checkmark-circle-outline' : 'information-circle-outline'}
        size={19}
        color={danger ? colors.alert : colors.ink}
      />
      <AppText variant="caption" color={danger ? colors.alert : colors.ink} style={{ flex: 1, fontSize: 14, lineHeight: 20 }}>
        {children}
      </AppText>
    </View>
  );
}

/** A small outlined tag, e.g. "Scanned" or "Need". */
export function Pill({ label, mark }: { label: string; mark?: ReactNode }) {
  return (
    <View style={styles.pill}>
      {mark}
      <AppText variant="caption" weight="medium" style={{ fontSize: 13 }}>
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

export function Row({ children, style, ...rest }: ViewProps) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: space.sm }, style]} {...rest}>
      {children}
    </View>
  );
}

export function Divider({ seed }: { seed?: number }) {
  return <SketchRule seed={seed ?? 7} opacity={0.2} />;
}

/** A settings-style row: optional ink icon, title, subtitle, and a trailing accessory or chevron. */
export function ListRow({
  icon,
  title,
  subtitle,
  right,
  onPress,
  destructive,
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  destructive?: boolean;
}) {
  const fg = destructive ? colors.alert : colors.ink;
  const content = (
    <View style={styles.listRow}>
      {icon && <Ionicons name={icon} size={21} color={fg} />}
      <View style={{ flex: 1, gap: 1 }}>
        <AppText color={fg}>{title}</AppText>
        {subtitle && (
          <AppText variant="caption" faint>
            {subtitle}
          </AppText>
        )}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={colors.pencil} /> : null)}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 24, paddingTop: space.lg, gap: 20, paddingBottom: 120, flexGrow: 1 },
  readable: { width: '100%', maxWidth: READABLE_MAX + 48, alignSelf: 'center' },
  card: { padding: 20, gap: space.md },
  sectionTitle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: space.xs },
  button: {
    minHeight: 52,
    borderRadius: 2,
    paddingHorizontal: space.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, minHeight: 38, borderRadius: 2 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  input: { flex: 1, minWidth: 0, minHeight: 44, fontSize: 17, fontFamily: fonts.regular, paddingVertical: 6, paddingHorizontal: 0, outlineStyle: 'solid', outlineWidth: 0 },
  banner: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 14 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 999, borderWidth: 1.2, borderColor: colors.ink, paddingHorizontal: 12, paddingVertical: 5, alignSelf: 'flex-start' },
  empty: { alignItems: 'center', gap: space.md, paddingVertical: space.lg, paddingHorizontal: space.lg },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13 },
});
