// Money-specific building blocks: the big number, the month bar, the goal bar, entry rows and the
// need/want switches.
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { Dots, Hatch, Mark, type MarkKind } from './marks';
import { Appear, GrowX, useCountUp, useFill } from './motion';
import { AppText, PressableScale, Segmented } from './ui';
import type { Necessity } from '../../shared/schemas';
import type { Tx } from '@/db/transactions';
import type { SafeToSpend } from '@/lib/budget';
import { categoryInfo, type CustomCategory } from '@/lib/categories';
import { formatFigure, formatMoney, splitMoney } from '@/lib/money';
import { colors, fonts, motion, type as typeScale } from '@/theme/tokens';

/**
 * A big amount: the symbol and cents sit small beside the whole number, which counts up to its value.
 * `size` is the whole number's size (96 on the dashboard, 72 on an entry).
 */
export function HeroAmount({
  cents,
  currency,
  size = 96,
  count = true,
  sign,
  style,
}: {
  cents: number;
  currency: string;
  size?: number;
  count?: boolean;
  /** Show "−" before an expense. */
  sign?: '−' | '+';
  style?: StyleProp<ViewStyle>;
}) {
  const shown = useCountUp(cents);
  const value = count ? shown : cents;
  const parts = splitMoney(value, currency);
  const small = Math.round(size * 0.3125);
  const smallLine = Math.round(size * 0.46);
  const track = -size * 0.05;
  const smallTrack = -small * 0.02;
  const minus = sign ?? (parts.negative ? '−' : '');
  const symbol = <AppText weight="extralight" style={{ fontSize: small, lineHeight: smallLine, letterSpacing: smallTrack, marginRight: 3 }}>{minus + parts.symbol}</AppText>;
  return (
    <View
      accessible
      accessibilityLabel={`${minus === '−' ? 'minus ' : ''}${formatMoney(Math.abs(cents), currency)}`}
      style={[{ flexDirection: 'row', alignItems: 'flex-start' }, style]}>
      {!parts.symbolAfter && symbol}
      <AppText
        weight="extralight"
        numberOfLines={1}
        adjustsFontSizeToFit
        style={[{ fontSize: size, lineHeight: size, letterSpacing: track }, tabularNums]}>
        {parts.whole}
      </AppText>
      <AppText weight="extralight" style={[{ fontSize: small, lineHeight: smallLine, letterSpacing: smallTrack, marginLeft: 2 }, tabularNums]}>
        {parts.fraction}
      </AppText>
      {parts.symbolAfter && symbol}
    </View>
  );
}

const tabularNums = { fontVariant: ['tabular-nums' as const] };

/** A number that counts up, in any text style (totals, stats). */
export function CountUp({
  cents,
  format,
  style,
  variant = 'number',
}: {
  cents: number;
  format: (cents: number) => string;
  style?: StyleProp<TextStyle>;
  variant?: keyof typeof typeScale;
}) {
  const shown = useCountUp(cents);
  return (
    <AppText variant={variant} style={[tabularNums, style]} accessibilityLabel={format(cents)}>
      {format(shown)}
    </AppText>
  );
}

const STATUS: Record<SafeToSpend['status'], { label: string; mark: MarkKind | null }> = {
  safe: { label: 'On track', mark: 'need' },
  tight: { label: 'Getting tight', mark: 'want' },
  over: { label: 'Over budget', mark: 'left' },
  unset: { label: '', mark: null },
};

/** "Safe to spend" on the left, how the month is going on the right. */
export function SafeHeader({ safe }: { safe: SafeToSpend }) {
  const s = STATUS[safe.status];
  return (
    <View style={styles.spread}>
      <AppText variant="caption" muted>
        Safe to spend
      </AppText>
      {safe.fromExpected && safe.status === 'safe' ? (
        <AppText variant="caption" muted>
          From your pay
        </AppText>
      ) : s.mark ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Mark kind={s.mark} size={6} />
          <AppText variant="caption">{s.label}</AppText>
        </View>
      ) : null}
    </View>
  );
}

type Part = { key: string; kind: 'need' | 'want' | 'bills' | 'savings' | 'left'; label: string; cents: number };

/**
 * One bar, one month: every dollar of income has a place. Needs are solid, wants hatched, bills still due
 * dotted, savings stone, and white is what's left. Parts grow in from the left, one after another.
 */
export function MonthBar({ safe, currency, legend = true, ticks = true }: { safe: SafeToSpend; currency: string; legend?: boolean; ticks?: boolean }) {
  const left = Math.max(0, safe.amount);
  const parts: Part[] = [
    { key: 'need', kind: 'need', label: 'Needs', cents: safe.need },
    { key: 'want', kind: 'want', label: 'Wants', cents: safe.want },
    { key: 'bills', kind: 'bills', label: 'Bills due', cents: safe.upcomingBills },
    { key: 'savings', kind: 'savings', label: 'Savings', cents: safe.savings },
    { key: 'left', kind: 'left', label: 'Left', cents: left },
  ];
  const scale = Math.max(1, safe.income, parts.reduce((s, p) => s + p.cents, 0));
  const shown = parts.filter((p) => p.cents > 0);
  const pct = (v: number) => Math.round((v / scale) * 100);
  const label = `Of ${formatMoney(safe.income, currency)} income: ${parts
    .filter((p) => p.cents > 0 || p.key === 'left')
    .map((p) => `${p.label.toLowerCase()} ${formatMoney(p.cents, currency)}`)
    .join(', ')}`;

  // Boundaries for the tick marks, and the two shares worth reading at a glance: needs and what's left.
  let edge = 0;
  const edges = [0];
  const centres: { key: string; at: number; text: string }[] = [];
  for (const p of shown) {
    if (p.key === 'need' || p.key === 'left') centres.push({ key: p.key, at: (edge + p.cents / 2) / scale, text: `${pct(p.cents)}%` });
    edge += p.cents;
    edges.push(Math.min(1, edge / scale));
  }

  return (
    <View>
      {ticks && shown.length > 0 && (
        <View aria-hidden style={{ height: 22 }}>
          {centres.map((c) => (
            <AppText key={c.key} variant="axis" muted style={[styles.tickLabel, { left: `${c.at * 100}%` }]}>
              {c.text}
            </AppText>
          ))}
          {edges.map((e, i) => (
            <View key={i} style={[styles.tick, e >= 0.999 ? { right: 0 } : { left: `${e * 100}%` }]} />
          ))}
        </View>
      )}
      <View accessible accessibilityRole="image" accessibilityLabel={label} style={styles.monthBar}>
        {shown.map((p, i) =>
          p.key === 'left' ? (
            <View key={p.key} style={{ flex: p.cents }} />
          ) : (
            <GrowX key={p.key} delay={i * motion.barStagger} style={{ flex: p.cents, backgroundColor: p.kind === 'need' ? colors.ink : p.kind === 'savings' ? colors.stone : colors.page, overflow: 'hidden' }}>
              {p.kind === 'want' && <Hatch />}
              {p.kind === 'bills' && <Dots />}
            </GrowX>
          ),
        )}
      </View>
      {legend && (
        <View style={styles.legend}>
          {parts.map((p) =>
            p.cents > 0 || p.key === 'left' || p.key === 'need' || p.key === 'want' ? (
              <View key={p.key} style={styles.legendItem}>
                <Mark kind={p.kind} size={10} />
                <AppText variant="caption" weight={p.key === 'left' ? 'medium' : undefined} style={{ flex: 1 }}>
                  {p.label}
                </AppText>
                <AppText variant="monoSmall" style={p.key === 'left' && { fontFamily: fonts.monoMedium }}>
                  {formatFigure(p.cents, currency)}
                </AppText>
              </View>
            ) : null,
          )}
        </View>
      )}
    </View>
  );
}

/** Quarter ticks under a goal bar: 0, 300, 600, 900, 1,200. */
function goalTicks(target: number, currency: string): string[] {
  return [0, 1, 2, 3, 4].map((q) => formatFigure(Math.round((target * q) / 4), currency, { whole: true }));
}

/**
 * The savings goal's bar: stone fills an ink outline from the left, easing to its new length whenever
 * money goes in. Dashed while nothing is saved.
 */
export function GoalBar({
  saved,
  target,
  currency,
  height = 12,
  showPct,
  scale,
}: {
  saved: number;
  target: number;
  currency: string;
  height?: number;
  /** The percentage above the end of the fill (the goal screen). */
  showPct?: boolean;
  /** Labels under the bar; quarter amounts by default. */
  scale?: string[];
}) {
  const fraction = target > 0 ? Math.min(1, saved / target) : 0;
  const fill = useFill(fraction, { delay: 120 });
  const pct = Math.round(fraction * 100);
  const labels = scale ?? goalTicks(target, currency);
  return (
    <View>
      {showPct && (
        <View aria-hidden style={{ height: 20 }}>
          <AppText
            variant="index"
            style={[styles.tickLabel, pct >= 92 ? { right: 0 } : pct <= 6 ? { left: 0 } : { left: `${pct}%` }, { transform: pct >= 92 || pct <= 6 ? [] : [{ translateX: -14 }] }]}>
            {pct}%
          </AppText>
        </View>
      )}
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={saved > 0 ? `${pct}% saved, ${formatMoney(saved, currency)} of ${formatMoney(target, currency)}` : 'Nothing saved yet'}
        accessibilityValue={{ min: 0, max: 100, now: pct }}
        style={[styles.goalBar, { height }, saved <= 0 && { borderStyle: 'dashed' }]}>
        {saved > 0 && <Animated.View style={[styles.goalFill, fraction >= 1 && { borderRightWidth: 0 }, fill]} />}
      </View>
      <View aria-hidden style={styles.goalTicks}>
        {labels.map((l, i) => (
          <AppText key={i} variant="axis" muted>
            {l}
          </AppText>
        ))}
      </View>
    </View>
  );
}

/** Label over a light number: "Income / 2,720.00". */
export function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <AppText variant="small" muted numberOfLines={1}>
        {label}
      </AppText>
      <View style={{ marginTop: 4 }}>{children}</View>
    </View>
  );
}

/** The mark beside an entry: income is a ring, needs solid, wants hatched, a mixed receipt both. */
export function entryMark(tx: Pick<Tx, 'type' | 'need_cents' | 'want_cents'>): MarkKind {
  if (tx.type === 'income') return 'income';
  if (tx.want_cents === 0) return 'need';
  if (tx.need_cents === 0) return 'want';
  return 'split';
}

export function EntryMark({ tx }: { tx: Pick<Tx, 'type' | 'need_cents' | 'want_cents'> }) {
  return <Mark kind={entryMark(tx)} size={8} />;
}

/** A row in a list of money: mark, name over a quiet line, and the figure in mono. */
export function MoneyRow({
  mark,
  title,
  subtitle,
  figure,
  onPress,
  accessibilityLabel,
  last,
  right,
}: {
  mark: MarkKind;
  title: string;
  subtitle?: string;
  figure: string;
  onPress?: () => void;
  accessibilityLabel?: string;
  last?: boolean;
  right?: ReactNode;
}) {
  const body = (
    <>
      <View style={{ width: 18 }}>
        <Mark kind={mark} size={8} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText numberOfLines={1} style={{ lineHeight: 20 }}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="small" muted numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      <AppText variant="mono">{figure}</AppText>
      {right}
    </>
  );
  const style = [styles.row, last && { borderBottomWidth: 0 }];
  if (!onPress) return <View style={style}>{body}</View>;
  return (
    <PressableScale onPress={onPress} scaleTo={0.985} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? `${title}, ${figure}`} style={style}>
      {body}
    </PressableScale>
  );
}

/** One entry in a list, with an optional fade-in delay for a list's first load. */
export function TxRow({
  tx,
  custom,
  onPress,
  showDate,
  delay,
  last,
}: {
  tx: Tx;
  custom?: CustomCategory[];
  onPress?: () => void;
  showDate?: string;
  /** Fade in after this many ms; undefined shows it straight away. */
  delay?: number;
  last?: boolean;
}) {
  const info = categoryInfo(tx.category, custom);
  const isIncome = tx.type === 'income';
  const mark = entryMark(tx);
  const kind = mark === 'need' ? 'need' : mark === 'want' ? 'want' : mark === 'split' ? 'need and want' : null;
  const sub = [
    showDate,
    isIncome ? 'Income' : info.label,
    kind,
    tx.source === 'recurring' ? 'repeats' : null,
    tx.source === 'scan' ? 'scanned' : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const figure = formatFigure(isIncome ? tx.amount_cents : -tx.amount_cents, tx.currency, { sign: true });
  return (
    <Appear delay={delay ?? 0} skip={delay === undefined}>
      <MoneyRow
        mark={mark}
        title={tx.merchant || info.label}
        subtitle={sub}
        figure={figure}
        last={last}
        onPress={onPress}
        accessibilityLabel={`${tx.merchant || info.label}, ${isIncome ? 'income' : 'spent'} ${formatMoney(tx.amount_cents, tx.currency)}${sub ? `, ${sub}` : ''}`}
      />
    </Appear>
  );
}

/** "Yesterday, Saturday 24" over a day's entries, with the day's total on the right. */
export function DayHeader({ label, total, currency }: { label: string; total: number; currency: string }) {
  return (
    <View style={[styles.spread, { marginTop: 24 }]} accessibilityRole="header">
      <AppText variant="small" muted>
        {label}
      </AppText>
      <AppText variant="index" muted>
        {formatFigure(total, currency, { sign: true })}
      </AppText>
    </View>
  );
}

/** The small Need | Want switch on a receipt line. */
export function NeedWantToggle({ value, onChange, label }: { value: Necessity; onChange: (v: Necessity) => void; label?: string }) {
  return (
    <Segmented
      compact
      label={label ?? 'Need or want'}
      value={value}
      onChange={onChange}
      options={[
        { value: 'need', label: 'Need' },
        { value: 'want', label: 'Want' },
      ]}
      style={{ width: 100 }}
    />
  );
}

/** Need or want for a manual entry: two halves with a line about each. */
export function NeedWantCards({ value, onChange }: { value: Necessity; onChange: (v: Necessity) => void }) {
  return (
    <Segmented
      label="Need or want"
      value={value}
      onChange={onChange}
      options={[
        { value: 'need', label: 'Need', mark: 'need', detail: 'Rent, food, bills, getting to work' },
        { value: 'want', label: 'Want', mark: 'want', detail: 'Nice to have, could skip' },
      ]}
    />
  );
}

/** Needs and wants of one entry as a single split bar. */
export function SplitBar({ need, want, currency }: { need: number; want: number; currency: string }) {
  const total = Math.max(1, need + want);
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${formatMoney(need, currency)} needs, ${formatMoney(want, currency)} wants`}
      style={[styles.monthBar, { flexDirection: 'row' }]}>
      {need > 0 && <GrowX style={{ flex: need / total, backgroundColor: colors.ink }} />}
      {want > 0 && (
        <GrowX delay={motion.barStagger} style={{ flex: want / total, overflow: 'hidden' }}>
          <Hatch />
        </GrowX>
      )}
    </View>
  );
}

/** Legend chip for a chart: a small mark and a word. */
export function Key({ kind, label }: { kind: MarkKind; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Mark kind={kind} size={8} />
      <AppText variant="small" muted>
        {label}
      </AppText>
    </View>
  );
}

/** A pressable white card with an ink edge (the AI mode actions, the check-in). */
export function Panel({ children, style, onPress, label }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; label?: string }) {
  if (!onPress) return <View style={[styles.panel, style]}>{children}</View>;
  return (
    <PressableScale onPress={onPress} haptics="light" accessibilityRole="button" accessibilityLabel={label} style={[styles.panel, style]}>
      {children}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  spread: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  tickLabel: { position: 'absolute', top: 0, transform: [{ translateX: -10 }] },
  tick: { position: 'absolute', bottom: 0, height: 6, width: 1, backgroundColor: colors.ink },
  monthBar: { flexDirection: 'row', height: 12, borderWidth: 1, borderColor: colors.ink, backgroundColor: colors.page, overflow: 'hidden' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 24, rowGap: 10, marginTop: 20 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '45%', flexGrow: 1 },
  goalBar: { flexDirection: 'row', borderWidth: 1, borderColor: colors.ink, backgroundColor: colors.page, overflow: 'hidden' },
  goalFill: { height: '100%', backgroundColor: colors.stone, borderRightWidth: 1, borderRightColor: colors.ink },
  goalTicks: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line, gap: 0 },
  panel: { backgroundColor: colors.page, borderWidth: 1, borderColor: colors.ink, padding: 20 },
});
