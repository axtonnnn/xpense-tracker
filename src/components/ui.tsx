// Design-system primitives shared by every screen: bone paper, square ink buttons, fields that are a line
// to write on, text tabs, chips, a square switch, rows and notices. See docs/brand/README.md for the rules.
import * as Haptics from 'expo-haptics';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming, type AnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from './icons';
import { Mark, type MarkKind } from './marks';
import { timing, useMotion } from './motion';
import { colors, fonts, MARGIN, motion, READABLE_MAX, space, type as typeScale, useWide, WIDE_MARGIN } from '@/theme/tokens';

export type { IconName };

type TextVariant = keyof typeof typeScale;
type Weight = 'extralight' | 'light' | 'regular' | 'medium';

export function AppText({
  variant = 'body',
  weight,
  color,
  muted,
  center,
  style,
  ...rest
}: TextProps & { variant?: TextVariant; weight?: Weight; color?: string; muted?: boolean; center?: boolean }) {
  return (
    <Text
      style={[
        typeScale[variant],
        weight && { fontFamily: fonts[weight] },
        { color: color ?? (muted ? colors.grey : colors.ink) },
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

/** Felt, not heard. Haptics stay on with Reduce Motion. */
export function haptic(kind: HapticKind = 'light'): void {
  if (Platform.OS === 'web') return;
  if (kind === 'select') Haptics.selectionAsync();
  else if (kind === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  else if (kind === 'warning') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** A Pressable that dips to 97% while pressed (120 ms), with an optional haptic tick. */
export function PressableScale({
  style,
  haptics,
  onPress,
  onPressIn,
  onPressOut,
  children,
  scaleTo = 0.97,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<AnimatedStyle<StyleProp<ViewStyle>>>;
  haptics?: HapticKind;
  children?: ReactNode;
  scaleTo?: number;
}) {
  const moving = useMotion();
  const p = useSharedValue(0);
  const anim = useAnimatedStyle(() =>
    moving ? { transform: [{ scale: 1 - (1 - scaleTo) * p.value }] } : { opacity: 1 - 0.35 * p.value },
  );
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        p.set(withTiming(1, timing(motion.quick)));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        p.set(withTiming(0, timing(motion.quick)));
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptics) haptic(haptics);
        onPress?.(e);
      }}
      style={[style, anim]}>
      {children}
    </AnimatedPressable>
  );
}

/** Side margins: 24 on phones, 40 beside the iPad and Mac sidebar. */
export function useMargin(): number {
  return useWide() ? WIDE_MARGIN : MARGIN;
}

/**
 * The paper every screen sits on. Content is centred and stops at a readable width on iPad and Mac;
 * pass `full` for screens that lay out their own columns.
 */
export function Screen({
  children,
  scroll = true,
  full,
  topInset = true,
  contentStyle,
  refresh,
}: {
  children: ReactNode;
  scroll?: boolean;
  full?: boolean;
  /** Pad for the status bar (every screen draws its own header). */
  topInset?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  /** Pull down to refresh (see usePullToSync). */
  refresh?: { refreshing: boolean; onRefresh: () => void };
}) {
  const insets = useSafeAreaInsets();
  const margin = useMargin();
  const inner = [
    styles.screen,
    { paddingHorizontal: margin, paddingTop: topInset ? insets.top + 12 : space.lg },
    !full && styles.readable,
    contentStyle,
  ];
  if (!scroll) return <View style={[{ flex: 1, backgroundColor: colors.paper }, inner]}>{children}</View>;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.paper }}
      contentContainerStyle={inner}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
      showsVerticalScrollIndicator={false}
      refreshControl={refresh ? <PullControl {...refresh} /> : undefined}>
      {children}
    </ScrollView>
  );
}

/** The pull-to-refresh spinner, in ink. */
export function PullControl({ refreshing, onRefresh }: { refreshing: boolean; onRefresh: () => void }) {
  return <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.ink} colors={[colors.ink]} progressBackgroundColor={colors.page} />;
}

/** A screen's big title (Display 60), with an optional line above and something on the right. */
export function PageTitle({ title, over, right, style }: { title: string; over?: ReactNode; right?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={style}>
      {over ? typeof over === 'string' ? <AppText variant="caption" muted>{over}</AppText> : over : null}
      <View style={styles.titleRow}>
        <AppText variant="display" accessibilityRole="header" style={{ flexShrink: 1, marginTop: over ? 4 : 0 }}>
          {title}
        </AppText>
        {right}
      </View>
    </View>
  );
}

/** A pushed screen's top bar: a back (or close) button, and an optional action on the right. */
export function TopBar({ onBack, close, right }: { onBack: () => void; close?: boolean; right?: ReactNode }) {
  return (
    <View style={styles.topBar}>
      <IconButton icon={close ? 'close' : 'back'} label={close ? 'Close' : 'Back'} onPress={onBack} style={{ marginLeft: -10 }} />
      {right}
    </View>
  );
}

/** Section header: a mono number, a 22 title, and an optional small link on the right. */
export function SectionHeader({
  index,
  title,
  action,
  style,
}: {
  index?: string;
  title: string;
  action?: { label: string; onPress: () => void };
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.sectionHeader, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, flexShrink: 1 }}>
        {index && (
          <AppText variant="index" muted aria-hidden>
            {index}
          </AppText>
        )}
        <AppText variant="title" accessibilityRole="header" style={{ flexShrink: 1 }}>
          {title}
        </AppText>
      </View>
      {action && <TextLink label={action.label} onPress={action.onPress} small />}
    </View>
  );
}

/** The line between sections: 40 above, 28 below. Pass `tight` for a bare line. */
export function Rule({ tight, style }: { tight?: boolean; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: 1, backgroundColor: colors.rule }, !tight && { marginTop: space.section, marginBottom: 28 }, style]} />;
}

type ButtonKind = 'primary' | 'secondary' | 'danger';

/** Square, 52 high. primary: ink. secondary: an ink outline. danger: alert red, for deleting only. */
export function Button({
  title,
  onPress,
  kind = 'primary',
  icon,
  loading,
  disabled,
  compact,
  style,
  accessibilityLabel,
  accessibilityHint,
}: {
  title: string;
  onPress: () => void;
  kind?: ButtonKind;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  /** 48 high, 14 text: buttons that sit side by side. */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  const filled = kind !== 'secondary';
  const fg = filled ? colors.onInk : colors.ink;
  const inactive = disabled || loading;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      onPress={onPress}
      disabled={inactive}
      haptics="light"
      style={[
        styles.button,
        compact && { minHeight: 48 },
        kind === 'primary' && { backgroundColor: colors.ink },
        kind === 'danger' && { backgroundColor: colors.alert },
        kind === 'secondary' && { borderWidth: 1, borderColor: colors.ink },
        { opacity: disabled ? 0.4 : 1 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Icon name={icon} size={20} color={fg} strokeWidth={1.5} />}
          <AppText weight="medium" color={fg} style={compact && { fontSize: 14 }}>
            {title}
          </AppText>
        </>
      )}
    </PressableScale>
  );
}

/** An underlined text link (15, or 13 beside a section title). */
export function TextLink({
  label,
  onPress,
  small,
  danger,
  muted,
  style,
}: {
  label: string;
  onPress: () => void;
  small?: boolean;
  danger?: boolean;
  muted?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={small ? 12 : 8}
      accessibilityRole="link"
      style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1, minHeight: small ? undefined : 44, justifyContent: 'center' }, style]}>
      <AppText
        variant={small ? 'caption' : 'body'}
        color={danger ? colors.alert : muted ? colors.grey : colors.ink}
        style={{ textDecorationLine: 'underline' }}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  size = 44,
  iconSize = 22,
  color = colors.ink,
  style,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  size?: number;
  iconSize?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      scaleTo={0.9}
      style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Icon name={icon} size={iconSize} color={color} />
    </PressableScale>
  );
}

/** The tiny padlock beside things that need Xpense Pro. */
export function LockGlyph({ color = colors.grey }: { color?: string }) {
  return (
    <View aria-hidden style={{ width: 8, height: 10 }}>
      <Icon name="lock" size={10} color={color} strokeWidth={2.4} />
    </View>
  );
}

/** "PRO", boxed in mono. */
export function ProTag({ light }: { light?: boolean }) {
  const c = light ? colors.onInk : colors.ink;
  return (
    <View style={{ borderWidth: 1, borderColor: c, paddingHorizontal: 6, paddingVertical: 1 }}>
      <AppText variant="axis" color={c} style={{ lineHeight: 14, letterSpacing: 0.8 }}>
        PRO
      </AppText>
    </View>
  );
}

/** A colour that eases between two values as `on` changes (180 ms). */
function useToggleColor(on: boolean) {
  const moving = useMotion();
  const p = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    p.set(moving ? withTiming(on ? 1 : 0, timing(motion.small)) : on ? 1 : 0);
  }, [on, moving, p]);
  return p;
}

/** A choice chip, 36 high: an outline, or solid ink when picked. */
export function Chip({
  label,
  selected,
  onPress,
  mark,
  locked,
  small,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  mark?: MarkKind;
  locked?: boolean;
  small?: boolean;
}) {
  const p = useToggleColor(!!selected);
  const box = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(p.value, [0, 1], ['rgba(17,17,17,0)', colors.ink]),
    borderColor: interpolateColor(p.value, [0, 1], [colors.rule, colors.ink]),
  }));
  const text = useAnimatedStyle(() => ({ color: interpolateColor(p.value, [0, 1], [colors.ink, colors.onInk]) }));
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={locked ? `${label}, needs Pro` : label}
      onPress={onPress}
      haptics="select"
      style={[styles.chip, box]}>
      {locked && <LockGlyph color={selected ? colors.onInk : colors.grey} />}
      {mark && <Mark kind={mark} size={8} color={selected ? colors.onInk : colors.ink} ground={selected ? colors.ink : colors.page} />}
      <Animated.Text style={[typeScale.body, { fontSize: small ? 13 : 14, lineHeight: 18 }, text]}>{label}</Animated.Text>
    </PressableScale>
  );
}

/**
 * Text tabs. The chosen one is ink with a 2 px underline that slides over (180 ms); `size="lg"` is the
 * big Expense / Income switch at the top of the Tracker.
 */
export function TextTabs<T extends string>({
  options,
  value,
  onChange,
  locked = [],
  size = 'sm',
  style,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  locked?: T[];
  size?: 'sm' | 'lg';
  style?: StyleProp<ViewStyle>;
}) {
  const moving = useMotion();
  const [layouts, setLayouts] = useState<Record<string, { x: number; w: number }>>({});
  const x = useSharedValue(0);
  const w = useSharedValue(0);
  const big = size === 'lg';
  const current = layouts[value];

  useEffect(() => {
    if (!current) return;
    const first = w.value === 0;
    x.set(moving && !first ? withTiming(current.x, timing(motion.small)) : current.x);
    w.set(moving && !first ? withTiming(current.w, timing(motion.small)) : current.w);
  }, [current, moving, x, w]);

  const underline = useAnimatedStyle(() => ({ width: w.value, transform: [{ translateX: x.value }] }));

  return (
    <View style={[styles.tabs, { gap: big ? 28 : 24 }, style]} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.value === value;
        const isLocked = locked.includes(o.value);
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={isLocked ? `${o.label}, needs Pro` : o.label}
            hitSlop={{ left: 8, right: 8 }}
            onLayout={(e: LayoutChangeEvent) => {
              const { x: lx, width } = e.nativeEvent.layout;
              setLayouts((cur) => (cur[o.value]?.x === lx && cur[o.value]?.w === width ? cur : { ...cur, [o.value]: { x: lx, w: width } }));
            }}
            onPress={() => {
              if (!active) haptic('select');
              onChange(o.value);
            }}
            style={{ height: big ? 52 : 44, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {isLocked && <LockGlyph />}
            <Text
              style={
                big
                  ? { fontFamily: fonts.light, fontSize: 28, letterSpacing: -0.84, color: active ? colors.ink : colors.grey }
                  : { fontFamily: active ? fonts.medium : fonts.regular, fontSize: 14, color: active ? colors.ink : colors.grey }
              }>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
      <Animated.View pointerEvents="none" style={[styles.tabLine, underline]} />
    </View>
  );
}

type SegmentOption<T> = { value: T; label: string; mark?: MarkKind; detail?: string };

/**
 * A two-part switch inside an ink outline. The ink block slides under the chosen half (180 ms) and the
 * labels above it turn white as it passes. With `detail` lines it becomes the Tracker's need/want cards.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  compact,
  height,
  style,
}: {
  options: [SegmentOption<T>, SegmentOption<T>];
  value: T;
  onChange: (v: T) => void;
  label: string;
  /** 30 high with 12 text: the Need | Want switch on a receipt line. */
  compact?: boolean;
  /** Overall height, when it sits beside a field (40). */
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const moving = useMotion();
  const [width, setWidth] = useState(0);
  const index = options[1].value === value ? 1 : 0;
  const p = useSharedValue(index);
  useEffect(() => {
    p.set(moving ? withTiming(index, timing(motion.small)) : index);
  }, [index, moving, p]);
  const half = width / 2;
  const block = useAnimatedStyle(() => ({ transform: [{ translateX: p.value * half }] }));
  const counter = useAnimatedStyle(() => ({ transform: [{ translateX: -p.value * half }] }));
  const tall = options.some((o) => o.detail);

  const labels = (onInk: boolean) => (
    <View style={{ flexDirection: 'row', width: width || undefined, flex: width ? undefined : 1 }}>
      {options.map((o, i) => (
        <View
          key={o.value}
          style={[
            tall ? styles.segTall : compact ? styles.segCompact : styles.segShort,
            height ? { height: height - 2 } : null,
            { flex: 1 },
            i === 0 && tall && { borderRightWidth: 1, borderRightColor: colors.ink },
          ]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {o.mark && (
              <Mark
                kind={o.mark}
                size={tall ? 10 : 8}
                color={onInk ? colors.onInk : colors.ink}
                ground={onInk ? colors.ink : colors.page}
              />
            )}
            <AppText weight={compact ? 'regular' : 'medium'} color={onInk ? colors.onInk : colors.ink} style={{ fontSize: tall ? 15 : compact ? 12 : 14, lineHeight: compact ? 16 : 20 }}>
              {o.label}
            </AppText>
          </View>
          {o.detail && (
            <AppText variant="small" color={onInk ? colors.rule : colors.grey} style={{ marginTop: 4 }}>
              {o.detail}
            </AppText>
          )}
        </View>
      ))}
    </View>
  );

  return (
    <View
      style={[styles.segmented, style]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width - 2)}
      accessibilityRole="radiogroup"
      accessibilityLabel={label}>
      {labels(false)}
      {width > 0 && (
        <Animated.View pointerEvents="none" style={[styles.segBlock, { width: half }, block]}>
          <Animated.View style={[{ width }, counter]}>{labels(true)}</Animated.View>
        </Animated.View>
      )}
      <View style={StyleSheet.absoluteFill}>
        <View style={{ flexDirection: 'row', flex: 1 }}>
          {options.map((o) => (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: o.value === value }}
              accessibilityLabel={o.detail ? `${o.label}: ${o.detail}` : o.label}
              onPress={() => {
                if (o.value !== value) haptic('light');
                onChange(o.value);
              }}
              style={{ flex: 1 }}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

/** Square switch, 48 × 28, like a light switch. The knob slides and the track turns ink (180 ms). */
export function Switch({
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
  const moving = useMotion();
  const p = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    p.set(moving ? withTiming(value ? 1 : 0, timing(motion.small)) : value ? 1 : 0);
  }, [value, moving, p]);
  const track = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(p.value, [0, 1], [colors.page, colors.ink]) }));
  const knob = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(p.value, [0, 1], [colors.rule, colors.page]),
    transform: [{ translateX: p.value * 20 }],
  }));
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={() => {
        haptic('light');
        onValueChange(!value);
      }}
      style={{ opacity: disabled ? 0.4 : 1 }}>
      <Animated.View style={[styles.switchTrack, track]}>
        <Animated.View style={[styles.switchKnob, knob]} />
      </Animated.View>
    </Pressable>
  );
}

/** A field is a label and a line to write on. The line thickens from the left when you type in it. */
export function Field({
  label,
  hint,
  error,
  prefix,
  right,
  style,
  onFocus,
  onBlur,
  ...rest
}: TextInputProps & { label?: string; hint?: string; error?: string | null; prefix?: string; right?: ReactNode }) {
  const moving = useMotion();
  const focus = useSharedValue(0);
  const line = useAnimatedStyle(() => (moving ? { transform: [{ scaleX: focus.value }] } : { opacity: focus.value }));
  const lineColor = error ? colors.alert : colors.ink;
  return (
    <View style={{ gap: 4 }}>
      {label && (
        <AppText variant="caption" muted>
          {label}
        </AppText>
      )}
      <View style={[styles.inputWrap, { borderBottomColor: lineColor }]}>
        {prefix && <AppText style={{ fontSize: 17, color: colors.grey }}>{prefix}</AppText>}
        <TextInput
          placeholderTextColor={colors.grey}
          style={[styles.input, style]}
          accessibilityLabel={rest.accessibilityLabel ?? label}
          onFocus={(e) => {
            focus.set(withTiming(1, timing(motion.small)));
            onFocus?.(e);
          }}
          onBlur={(e) => {
            focus.set(withTiming(0, timing(motion.small)));
            onBlur?.(e);
          }}
          {...rest}
        />
        {right}
        <Animated.View pointerEvents="none" style={[styles.focusLine, { backgroundColor: lineColor }, line]} />
      </View>
      {error ? (
        <AppText variant="caption" color={colors.alert} accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" muted style={{ marginTop: 4 }}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

/**
 * A big amount to type: a grey "$" and light figures on an ink line. 72 in the Tracker, 64 in sheets.
 */
export function AmountField({
  symbol,
  size = 72,
  style,
  ...rest
}: TextInputProps & { symbol: string; size?: number }) {
  return (
    <View style={[styles.amountWrap, style as StyleProp<ViewStyle>]}>
      <AppText aria-hidden style={{ fontFamily: fonts.light, fontSize: size * 0.47, lineHeight: size * 0.6, color: colors.grey }}>
        {symbol}
      </AppText>
      <TextInput
        placeholder="0"
        placeholderTextColor={colors.rule}
        inputMode="decimal"
        keyboardType="decimal-pad"
        style={[
          styles.amountInput,
          { fontSize: size, lineHeight: size * 1.06, letterSpacing: -size * 0.05, height: size * 1.1 } as TextStyle,
        ]}
        {...rest}
      />
    </View>
  );
}

/** A short message in a white box. Alert is only for errors. */
export function Notice({ tone = 'info', children, style }: { tone?: 'info' | 'alert'; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const alert = tone === 'alert';
  const c = alert ? colors.alert : colors.ink;
  return (
    <View style={[styles.notice, { borderColor: alert ? colors.alert : colors.rule }, style]} accessibilityRole={alert ? 'alert' : undefined}>
      <View style={{ marginTop: 1 }}>
        <Icon name={alert ? 'alert' : 'info'} size={18} color={c} />
      </View>
      <View style={{ flex: 1 }}>
        {typeof children === 'string' ? (
          <AppText color={c} style={{ fontSize: 14, lineHeight: 20 }}>
            {children}
          </AppText>
        ) : (
          children
        )}
      </View>
    </View>
  );
}

/** The person's initial in a thin circle. */
export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  return (
    <View
      aria-hidden
      style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 1, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' }}>
      <AppText weight={size > 48 ? 'light' : 'regular'} style={{ fontSize: size > 48 ? 22 : 15, lineHeight: size > 48 ? 26 : 20 }}>
        {(name.trim()[0] ?? '·').toUpperCase()}
      </AppText>
    </View>
  );
}

export function EmptyState({
  picture,
  title,
  body,
  action,
}: {
  picture?: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.empty}>
      {picture}
      <AppText variant="title" center style={{ marginTop: picture ? 28 : 0 }}>
        {title}
      </AppText>
      <AppText muted center style={{ marginTop: 8, maxWidth: 320 }}>
        {body}
      </AppText>
      {action && <View style={{ marginTop: 12 }}>{action}</View>}
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

/**
 * A settings-style row on a light line: a title (and optional line under it), then a switch, a value or
 * a chevron. `external` shows the leave-the-app arrow instead.
 */
export function ListRow({
  title,
  subtitle,
  over,
  right,
  onPress,
  external,
  destructive,
  tag,
}: {
  title: string;
  subtitle?: string;
  /** A small grey label above the title ("Saving for"). */
  over?: string;
  right?: ReactNode;
  onPress?: () => void;
  external?: boolean;
  destructive?: boolean;
  tag?: ReactNode;
}) {
  const content = (
    <View style={[styles.listRow, { minHeight: subtitle || over ? 60 : 52 }]}>
      <View style={{ flex: 1, gap: 1 }}>
        {over && (
          <AppText variant="caption" muted>
            {over}
          </AppText>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <AppText color={destructive ? colors.alert : colors.ink} style={{ flexShrink: 1 }}>
            {title}
          </AppText>
          {tag}
        </View>
        {subtitle && (
          <AppText variant="caption" muted>
            {subtitle}
          </AppText>
        )}
      </View>
      {right ?? (onPress ? <Icon name={external ? 'external' : 'chevron'} size={16} strokeWidth={1.5} /> : null)}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={external ? 'link' : 'button'}
      accessibilityLabel={subtitle ? `${over ? `${over}: ` : ''}${title}, ${subtitle}` : over ? `${over}: ${title}` : title}
      style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { paddingBottom: 48, flexGrow: 1 },
  readable: { width: '100%', maxWidth: READABLE_MAX + 2 * WIDE_MARGIN, alignSelf: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space.md },
  topBar: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.md },
  button: {
    minHeight: 52,
    paddingHorizontal: space.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 36, borderWidth: 1 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.rule },
  tabLine: { position: 'absolute', left: 0, bottom: -1, height: 2, backgroundColor: colors.ink },
  segmented: { flexDirection: 'row', borderWidth: 1, borderColor: colors.ink, backgroundColor: colors.page, overflow: 'hidden' },
  segShort: { height: 42, alignItems: 'center', justifyContent: 'center' },
  segCompact: { height: 28, alignItems: 'center', justifyContent: 'center' },
  segTall: { padding: 14, justifyContent: 'flex-start' },
  segBlock: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.ink, overflow: 'hidden' },
  switchTrack: { width: 48, height: 28, borderWidth: 1, borderColor: colors.ink },
  switchKnob: { position: 'absolute', top: 2, left: 2, width: 22, height: 22 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, borderBottomWidth: 1 },
  input: {
    flex: 1,
    minWidth: 0,
    height: 44,
    fontSize: 17,
    fontFamily: fonts.regular,
    color: colors.ink,
    paddingVertical: 0,
    paddingHorizontal: 0,
    outlineStyle: 'solid',
    outlineWidth: 0,
  },
  focusLine: { position: 'absolute', left: 0, right: 0, bottom: -1, height: 2, transformOrigin: 'left center' },
  amountWrap: { flexDirection: 'row', alignItems: 'baseline', gap: 6, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.ink },
  amountInput: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.extralight,
    color: colors.ink,
    paddingVertical: 0,
    paddingHorizontal: 0,
    outlineStyle: 'solid',
    outlineWidth: 0,
  },
  notice: { flexDirection: 'row', gap: 12, paddingVertical: 14, paddingHorizontal: 16, backgroundColor: colors.page, borderWidth: 1 },
  empty: { alignItems: 'center', paddingVertical: space.xl, paddingHorizontal: space.lg },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
});
