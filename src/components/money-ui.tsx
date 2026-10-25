// Money-specific building blocks: entry rows, stat tiles, the safe-to-spend card and need/want pickers.
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Hatch, IncomeMark, NeedMark, PageFill, SketchFrame, SketchRule, SplitMark, Stamp, WantMark } from './sketch';
import { AppText, Card, Label, PressableScale, Row, tabular, useSeed } from './ui';
import type { Necessity } from '../../shared/schemas';
import type { Tx } from '@/db/transactions';
import type { SafeToSpend } from '@/lib/budget';
import { categoryInfo, type CustomCategory } from '@/lib/categories';
import { formatDay } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { colors, space } from '@/theme/tokens';

export type Delta = { pct: number | null; goodWhenUp: boolean; vs: string; suffix?: string };

export function deltaText(delta?: Delta): string | null {
  if (!delta || delta.pct === null) return null;
  if (delta.pct === 0) return `same as ${delta.vs}`;
  return `${delta.pct > 0 ? 'up' : 'down'} ${Math.abs(delta.pct)}${delta.suffix ?? '%'} on ${delta.vs}`;
}

export function StatTile({ label, value, sub, delta }: { label: string; value: string; sub?: string; delta?: Delta }) {
  const line = deltaText(delta) ?? sub;
  return (
    <Card style={styles.tile}>
      <AppText variant="caption" muted numberOfLines={1}>
        {label}
      </AppText>
      <AppText variant="number" numberOfLines={1} adjustsFontSizeToFit style={tabular}>
        {value}
      </AppText>
      {line && (
        <AppText variant="caption" faint numberOfLines={1} style={{ fontSize: 12 }}>
          {line}
        </AppText>
      )}
    </Card>
  );
}

const STAMP = { safe: 'on track', tight: 'getting tight', over: 'over budget', unset: null } as const;

/**
 * The dashboard's hero: what is safe to spend, and a sketched meter of this month's budget split into
 * needs spent (solid), wants spent (hatched), bills still due (sand) and what's left (blank page).
 */
export function SafeToSpendCard({
  safe,
  spent,
  savingsGoalCents,
  currency,
  onSetup,
}: {
  safe: SafeToSpend;
  spent: { need: number; want: number };
  savingsGoalCents: number;
  currency: string;
  onSetup?: () => void;
}) {
  const stamp = STAMP[safe.status];
  const budget = Math.max(1, safe.budget);
  const parts = [
    { key: 'need', value: spent.need },
    { key: 'want', value: spent.want },
    { key: 'bills', value: safe.upcomingBills },
    { key: 'left', value: Math.max(0, safe.amount) },
  ];
  const used = parts.reduce((s, p) => s + p.value, 0);
  const scale = Math.max(budget, used);
  return (
    <Card seed="safe-to-spend" style={{ gap: 6, paddingTop: 22 }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Label>Safe to spend</Label>
        {stamp && <Stamp label={stamp} style={{ marginTop: -6, marginRight: -4 }} />}
      </Row>
      {safe.status === 'unset' ? (
        <>
          <AppText variant="title" style={{ marginTop: 4 }}>
            Add your take-home pay to see what&apos;s safe to spend each day.
          </AppText>
          <Pressable onPress={onSetup} accessibilityRole="button" style={{ marginTop: space.sm }}>
            <AppText style={{ textDecorationLine: 'underline' }}>Add my pay</AppText>
          </Pressable>
        </>
      ) : (
        <>
          <AppText variant="hero" color={safe.amount < 0 ? colors.alert : colors.ink} style={[tabular, { marginTop: 2 }]} numberOfLines={1} adjustsFontSizeToFit>
            {formatMoney(safe.amount, currency)}
          </AppText>
          <AppText variant="caption" muted style={{ fontSize: 14 }}>
            {safe.amount > 0 ? (
              <>
                About <AppText variant="caption" weight="semibold" style={{ fontSize: 14 }}>{formatMoney(safe.perDay, currency)} a day</AppText> for the{' '}
                {safe.daysLeft === 1 ? 'last day' : `${safe.daysLeft} days left`}
              </>
            ) : (
              'Cover needs first and pause the wants until next month.'
            )}
          </AppText>
          <View
            style={styles.meter}
            accessibilityRole="progressbar"
            accessibilityLabel={`${formatMoney(Math.max(0, safe.amount), currency)} left of ${formatMoney(safe.budget, currency)} this month`}>
            {parts.map((p) =>
              p.value > 0 ? (
                <View
                  key={p.key}
                  style={{
                    flex: p.value / scale,
                    backgroundColor: p.key === 'need' ? colors.ink : p.key === 'bills' ? colors.sand : 'transparent',
                    borderRightWidth: p.key === 'left' ? 0 : 1,
                    borderColor: colors.ink,
                    overflow: 'hidden',
                  }}>
                  {p.key === 'want' && <Hatch />}
                </View>
              ) : null,
            )}
            <SketchFrame seed={61} weight={1.4} />
          </View>
          <View style={styles.legend}>
            <LegendLine mark={<NeedMark size={11} />} label="Needs" value={formatMoney(spent.need, currency)} />
            <LegendLine mark={<WantMark size={11} />} label="Wants" value={formatMoney(spent.want, currency)} />
            <LegendLine
              mark={<View style={{ width: 11, height: 11, backgroundColor: colors.sand, borderWidth: 1, borderColor: colors.ink }} />}
              label="Bills due"
              value={formatMoney(safe.upcomingBills, currency)}
            />
            <LegendLine
              mark={<View style={{ width: 11, height: 11, borderWidth: 1, borderColor: colors.ink }} />}
              label="Left"
              value={formatMoney(Math.max(0, safe.amount), currency)}
            />
          </View>
          {savingsGoalCents > 0 && (
            <AppText variant="caption" faint style={{ marginTop: space.sm }}>
              Your {formatMoney(savingsGoalCents, currency)} savings goal is already set aside.
            </AppText>
          )}
        </>
      )}
    </Card>
  );
}

function LegendLine({ mark, label, value }: { mark: ReactNode; label: string; value: string }) {
  return (
    <View style={styles.legendLine}>
      {mark}
      <AppText variant="caption" style={{ flex: 1 }}>
        {label}
      </AppText>
      <AppText variant="caption" weight="semibold" style={tabular}>
        {value}
      </AppText>
    </View>
  );
}

/** The mark beside an entry: its need/want split, or a ring for income. */
export function EntryMark({ tx }: { tx: Pick<Tx, 'type' | 'need_cents' | 'want_cents'> }) {
  if (tx.type === 'income') return <IncomeMark size={14} />;
  return <SplitMark need={tx.need_cents} want={tx.want_cents} />;
}

export function TxRow({
  tx,
  custom,
  onPress,
  showDate,
  last,
}: {
  tx: Tx;
  custom?: CustomCategory[];
  onPress?: () => void;
  showDate?: boolean;
  last?: boolean;
}) {
  const info = categoryInfo(tx.category, custom);
  const isIncome = tx.type === 'income';
  const kind = isIncome ? null : tx.want_cents === 0 ? 'need' : tx.need_cents === 0 ? 'want' : null;
  const sub = [
    showDate ? formatDay(tx.occurred_on, { weekday: 'short', day: 'numeric' }) : null,
    info.label,
    tx.source === 'scan' ? 'scanned' : tx.source === 'recurring' ? 'repeats' : null,
    kind,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${tx.merchant || info.label}, ${isIncome ? 'income' : 'expense'} ${formatMoney(tx.amount_cents, tx.currency)}`}
      style={({ pressed }) => [styles.txRow, { opacity: pressed ? 0.55 : 1 }]}>
      <EntryMark tx={tx} />
      <View style={{ flex: 1, gap: 2 }}>
        <AppText numberOfLines={1} style={{ fontSize: 15 }}>
          {tx.merchant || info.label}
        </AppText>
        <AppText variant="caption" faint numberOfLines={1} style={{ fontSize: 12 }}>
          {sub}
        </AppText>
      </View>
      <AppText weight="semibold" style={[tabular, { fontSize: 15 }]}>
        {isIncome ? '+' : '−'}
        {formatMoney(tx.amount_cents, tx.currency)}
      </AppText>
      {!last && <SketchRule seed={tx.id.length + tx.amount_cents} opacity={0.18} style={styles.rowRule} />}
    </Pressable>
  );
}

/** A two-part plate for one receipt line: Need | Want. */
export function NeedWantToggle({ value, onChange }: { value: Necessity; onChange: (v: Necessity) => void }) {
  return (
    <View style={styles.nwToggle} accessibilityRole="radiogroup">
      {(['need', 'want'] as const).map((k) => {
        const active = value === k;
        return (
          <PressableScale
            key={k}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={k === 'need' ? 'Need' : 'Want'}
            haptics="select"
            onPress={() => onChange(k)}
            style={[styles.nwSeg, active && { backgroundColor: colors.ink }]}>
            <AppText variant="caption" weight="semibold" color={active ? colors.onInk : colors.pencil} style={{ fontSize: 12 }}>
              {k === 'need' ? 'Need' : 'Want'}
            </AppText>
          </PressableScale>
        );
      })}
    </View>
  );
}

/** Two cards to choose need or want for a manual entry. */
export function NeedWantCards({ value, onChange }: { value: Necessity; onChange: (v: Necessity) => void }) {
  return (
    <Row style={{ gap: 14, alignItems: 'stretch' }}>
      <NeedWantCard kind="need" title="Need" body="Can’t really skip it" active={value === 'need'} onPress={() => onChange('need')} />
      <NeedWantCard kind="want" title="Want" body="Nice, but optional" active={value === 'want'} onPress={() => onChange('want')} />
    </Row>
  );
}

function NeedWantCard({ kind, title, body, active, onPress }: { kind: Necessity; title: string; body: string; active: boolean; onPress: () => void }) {
  const seed = useSeed(kind);
  return (
    <PressableScale
      onPress={onPress}
      haptics="select"
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${title}: ${body}`}
      style={styles.nwCard}>
      <PageFill />
      <SketchFrame seed={seed} weight={active ? 2.2 : 1.3} opacity={active ? 1 : 0.45} twice={active} />
      <Row style={{ justifyContent: 'space-between' }}>
        {kind === 'need' ? <NeedMark size={18} /> : <WantMark size={18} />}
        {active && (
          <View style={styles.check}>
            <AppText variant="caption" color={colors.onInk} style={{ fontSize: 11, lineHeight: 13 }}>
              ✓
            </AppText>
          </View>
        )}
      </Row>
      <AppText weight="semibold" style={{ marginTop: 10 }}>
        {title}
      </AppText>
      <AppText variant="caption" muted>
        {body}
      </AppText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  tile: { flexBasis: '45%', flexGrow: 1, padding: 16, gap: 2 },
  meter: { height: 22, flexDirection: 'row', marginTop: 14, backgroundColor: colors.page },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 8, marginTop: 10 },
  legendLine: { flexDirection: 'row', alignItems: 'center', gap: 8, flexBasis: '45%', flexGrow: 1 },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  rowRule: { position: 'absolute', left: 28, right: 0, bottom: -3 },
  nwToggle: { flexDirection: 'row', borderWidth: 1.2, borderColor: colors.ink, borderRadius: 2 },
  nwSeg: { width: 50, height: 28, alignItems: 'center', justifyContent: 'center' },
  nwCard: { flex: 1, padding: 16 },
  check: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
});
