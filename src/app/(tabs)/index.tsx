import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CheckinPanel, GoalInvite, GoalSummary, MoneySheet, useMoneySheet } from '@/components/goal-ui';
import { Icon } from '@/components/icons';
import { Hatch } from '@/components/marks';
import { Appear, GrowX, useEntrance } from '@/components/motion';
import { CountUp, DayHeader, HeroAmount, MonthBar, SafeHeader, Stat, TxRow } from '@/components/money-ui';
import { ProgressChart, type ChartBucket } from '@/components/ProgressChart';
import { AppText, Avatar, Button, PageTitle, Rule, Screen, SectionHeader, TextLink, TextTabs } from '@/components/ui';
import { depositsBetween, useActiveGoal } from '@/db/goals';
import { useLiveQuery } from '@/db/live';
import { listRecurring, type Recurring } from '@/db/recurring';
import { useSettings, type Settings } from '@/db/settings';
import { useSync } from '@/db/SyncProvider';
import { listBetween, listRecentScans, type Tx } from '@/db/transactions';
import { useUser } from '@/lib/auth';
import {
  categoryBreakdown,
  chartSeries,
  comparePeriods,
  needsShare,
  nextBill,
  nextDue,
  periodRange,
  plannedIncome,
  previousRange,
  PRO_PERIODS,
  safeToSpend,
  wantsTrend,
  type Bucket,
  type Period,
  type SafeToSpend,
} from '@/lib/budget';
import { categoryInfo } from '@/lib/categories';
import { addDays, dayHeading, endOfMonth, formatDay, ordinal, parseISODate, startOfMonth, today } from '@/lib/dates';
import { checkinDue, movesBetween } from '@/lib/goal';
import { formatFigure, formatMoney } from '@/lib/money';
import { usePro, useRequirePro } from '@/lib/pro';
import { colors, motion, useWide } from '@/theme/tokens';

const PERIODS: { value: Period; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: '6m', label: '6 months' },
  { value: '1y', label: '1 year' },
];

/** Changes this small (in %) read as "about level" rather than up or down. */
const LEVEL_PCT = 2;

function greeting(name: string): string {
  const now = new Date();
  const h = now.getHours();
  const part = h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
  const day = now.toLocaleDateString(undefined, { weekday: 'long' });
  return name ? `${day} ${part}, ${name}` : `${day} ${part}`;
}

const monthLong = (iso: string) => parseISODate(iso).toLocaleDateString(undefined, { month: 'long' });
const monthShort = (iso: string, year?: boolean) => parseISODate(iso).toLocaleDateString(undefined, year ? { month: 'short', year: 'numeric' } : { month: 'short' });

function periodTitle(period: Period, t: string): string {
  if (period === 'week') return 'This week';
  if (period === 'month') return monthLong(t);
  return period === '6m' ? 'Six months' : 'This year';
}

function chartHeading(period: Period, range: { start: string; end: string }): string {
  if (period === 'week') return 'This week by day';
  if (period === 'month') return `${monthLong(range.start)} by week`;
  return `${monthShort(range.start, true)} – ${monthShort(range.end, true)}`;
}

export default function Dashboard() {
  const settings = useSettings();
  const user = useUser();
  const wide = useWide();
  const { isPro } = usePro();
  const requirePro = useRequirePro();
  const goal = useActiveGoal();
  const money = useMoneySheet();
  const [period, setPeriod] = useState<Period>('month');
  const [picked, setPicked] = useState<{ period: Period; index: number } | null>(null);
  const t = today();
  const monthStart = startOfMonth(t);
  const monthEnd = endOfMonth(t);

  const range = periodRange(period, t);
  const prev = previousRange(period, t);
  const from = [prev.start, monthStart].sort()[0];
  const to = [range.end, monthEnd].sort()[1];
  const { data: txs } = useLiveQuery((db) => listBetween(db, from, to), [from, to]);
  const { data: recurring } = useLiveQuery(listRecurring, []);
  const { data: monthDeposits } = useLiveQuery((db) => depositsBetween(db, monthStart, monthEnd), [monthStart, monthEnd]);
  const { data: scans } = useLiveQuery((db) => listRecentScans(db, 1), []);

  if (!txs || !settings || !recurring || goal === undefined || !monthDeposits) return <Screen>{null}</Screen>;

  const currency = settings.currency;
  const safe = safeToSpend({
    today: t,
    txs,
    expectedIncomeCents: settings.monthlyIncomeCents,
    savingsGoalCents: settings.savingsGoalCents,
    recurring,
    savingsMoves: movesBetween(monthDeposits, monthStart, monthEnd),
  });
  const isNew = txs.length === 0;
  const name = settings.name || user.name || '';
  const long = period === '6m' || period === '1y';
  const checkin =
    goal && !long
      ? checkinDue({ today: t, startedOn: goal.goal.started_on, setAside: settings.savingsGoalCents, deposits: goal.deposits, answered: settings.goalCheckin })
      : null;

  const choosePeriod = (p: Period) => {
    if (PRO_PERIODS.includes(p) && !requirePro('long_range_charts')) return;
    setPeriod(p);
  };

  // Sections are numbered in the order they appear: first day (start here, goal), a month or week
  // (goal, chart, recent), or months (chart, where it went).
  const num = {
    start: '01',
    goal: isNew ? '02' : '01',
    chart: long ? '01' : '02',
    where: '02',
    recent: '03',
  };

  const raw = chartSeries(txs, period, t);
  const planned = plannedIncome(raw, recurring, t);
  const buckets: ChartBucket[] = raw.map((b, i) => ({ ...b, planned: planned[i] }));
  const current = Math.max(0, buckets.findIndex((b) => t >= b.start && t <= b.end));
  const nextPay = nextDue(recurring, t, 'income', range.end);
  // Only mention the dashed ring when the chart draws one.
  const dashed = buckets.some((b) => !b.income && (b.planned ?? 0) > 0);
  const nextPayOn = dashed && nextPay && nextPay.on > t ? nextPay.on : null;
  const selected = picked?.period === period ? picked.index : current;

  const header = (
    <View style={wide ? styles.wideHeader : undefined}>
      {!wide && (
        <View style={styles.topRow}>
          <AppText variant="caption" muted numberOfLines={1}>
            {greeting(name)}
          </AppText>
          <Pressable onPress={() => router.push('/settings')} accessibilityRole="button" accessibilityLabel="Settings and account" hitSlop={4}>
            <Avatar name={name || user.email || 'X'} />
          </Pressable>
        </View>
      )}
      <PageTitle title={periodTitle(period, t)} over={wide ? greeting(name) : undefined} style={!wide && { marginTop: 20 }} />
      {wide && <Button title="Add entry" icon="add" onPress={() => router.navigate('/tracker')} style={{ minHeight: 44, paddingHorizontal: 18 }} />}
    </View>
  );

  const tabs = (
    <TextTabs
      options={isNew ? PERIODS.slice(0, 2) : PERIODS}
      value={period}
      onChange={choosePeriod}
      locked={isPro ? [] : PRO_PERIODS}
      style={{ marginTop: wide ? 20 : 24 }}
    />
  );

  const goalSection = goal ? (
    <GoalSummary index={num.goal} state={goal} setAside={settings.savingsGoalCents} currency={currency} onAdd={() => money.open('add')} />
  ) : (
    <GoalInvite index={num.goal} />
  );

  const chart = (
    <ProgressChart
      key={period}
      index={num.chart}
      heading={chartHeading(period, range)}
      buckets={buckets}
      currency={currency}
      selected={selected}
      onSelect={(index) => setPicked({ period, index })}
      label={(b) => (period === '1y' ? b.label.charAt(0) : b.label)}
      readout={(b) => <Readout b={b} period={period} t={t} currency={currency} nextPayOn={nextPayOn} />}
    />
  );

  const sheet = goal && money.sheet && (
    <MoneySheet
      key={money.sheet.key}
      open={money.sheet.open}
      mode={money.sheet.mode}
      forMonth={money.sheet.forMonth}
      onClose={money.close}
      onGone={money.gone}
      state={goal}
      setAside={settings.savingsGoalCents}
      currency={currency}
    />
  );

  if (long) {
    const sections = (
      <>
        <Appear>{chart}</Appear>
        <Rule />
        <LongStats txs={txs} range={range} currency={currency} />
        <Rule />
        <WhereItWent index={num.where} txs={txs} range={range} settings={settings} />
        <Rule />
        <LongLead txs={txs} buckets={buckets} range={range} />
      </>
    );
    return (
      <Screen full={wide}>
        {header}
        {tabs}
        <View style={{ marginTop: 44 }}>{sections}</View>
        {sheet}
      </Screen>
    );
  }

  const safeSection = (
    <SafeSection safe={safe} currency={currency} isNew={isNew} goalName={goal?.goal.name} setAside={settings.savingsGoalCents} />
  );
  const startHere = isNew ? <StartHere index={num.start} recurring={recurring} scanned={!!scans?.length} /> : null;
  const goalBlock = goalSection;
  const chartBlock = isNew ? null : chart;
  const stats = isNew ? null : <ShortStats txs={txs} period={period} t={t} currency={currency} />;
  const lead = isNew ? null : <Lead txs={txs} period={period} t={t} prevStart={prev.start} recurring={recurring} currency={currency} />;
  const recent = isNew ? null : <Recent index={num.recent} txs={txs} settings={settings} />;
  const checkinPanel =
    checkin && goal ? <CheckinPanel checkin={checkin} goal={goal.goal} currency={currency} onOther={() => money.open('add', checkin.month)} /> : null;

  if (wide) {
    return (
      <Screen full>
        {header}
        {tabs}
        {checkinPanel}
        <View style={styles.columns}>
          <View style={{ flex: 1 }}>
            <Appear>{safeSection}</Appear>
            {chartBlock && <View style={styles.topRule}>{chartBlock}</View>}
            {startHere && <View style={styles.topRule}>{startHere}</View>}
          </View>
          <View style={{ flex: 1 }}>
            {stats}
            <View style={stats ? styles.topRule : undefined}>{goalBlock}</View>
            {recent && <View style={styles.topRule}>{recent}</View>}
            {lead && <View style={styles.topRule}>{lead}</View>}
          </View>
        </View>
        <Footer />
        {sheet}
      </Screen>
    );
  }

  return (
    <Screen>
      {header}
      {tabs}
      {checkinPanel}
      <Appear style={{ marginTop: checkinPanel ? 36 : 44 }}>{safeSection}</Appear>
      {startHere && (
        <>
          <Rule />
          <Appear delay={60}>{startHere}</Appear>
        </>
      )}
      <Rule />
      <Appear delay={isNew ? 120 : 60}>{goalBlock}</Appear>
      {chartBlock && (
        <>
          <Rule />
          {chartBlock}
          <Rule />
          {stats}
          {lead && (
            <>
              <Rule />
              {lead}
            </>
          )}
          <Rule />
          {recent}
        </>
      )}
      <Footer />
      {sheet}
    </Screen>
  );
}

/** Safe to spend: the big number, what it means per day, and the month bar. */
function SafeSection({
  safe,
  currency,
  isNew,
  goalName,
  setAside,
}: {
  safe: SafeToSpend;
  currency: string;
  isNew: boolean;
  goalName?: string;
  setAside: number;
}) {
  if (safe.status === 'unset') {
    return (
      <View>
        <AppText variant="caption" muted>
          Safe to spend
        </AppText>
        <AppText variant="lead" style={{ marginTop: 8 }}>
          Add your take-home pay to see what’s safe to spend each day.
        </AppText>
        <TextLink label="Add my pay" onPress={() => router.push('/settings')} style={{ alignSelf: 'flex-start', marginTop: 4 }} />
      </View>
    );
  }
  return (
    <View>
      <SafeHeader safe={safe} />
      <HeroAmount cents={safe.amount} currency={currency} style={{ marginTop: 8 }} />
      <AppText muted style={{ marginTop: 8 }}>
        {safe.amount > 0 ? (
          <>
            About <AppText>{formatMoney(safe.perDay, currency)} a day</AppText> for the {safe.daysLeft === 1 ? 'last day' : `${safe.daysLeft} days left`}
          </>
        ) : (
          'Cover needs first and pause the wants until next month.'
        )}
      </AppText>
      {isNew ? (
        <>
          <View style={{ marginTop: 28 }}>
            <MonthBar safe={safe} currency={currency} legend={false} ticks={false} />
          </View>
          {setAside > 0 && (
            <AppText variant="caption" muted style={{ marginTop: 14 }}>
              Your {formatMoney(setAside, currency, { compact: true })}
              {goalName ? ` for ${goalName.trim().replace(/^(a|an|the|my)\s+/i, 'the ')}` : ' for savings'} is set aside first. The rest fills in with needs and
              wants as you add them.
            </AppText>
          )}
        </>
      ) : (
        <View style={{ marginTop: 32 }}>
          <MonthBar safe={safe} currency={currency} />
        </View>
      )}
    </View>
  );
}

/** First day: three steps that make the numbers right. */
function StartHere({ index, recurring, scanned }: { index: string; recurring: Recurring[]; scanned: boolean }) {
  const steps = [
    {
      done: recurring.some((r) => r.type === 'income'),
      title: 'Set your paycheck to repeat',
      sub: 'Xpense adds it on payday for you',
      go: () => router.navigate({ pathname: '/tracker', params: { type: 'income' } }),
    },
    {
      done: recurring.some((r) => r.type === 'expense'),
      title: 'Add rent and bills that repeat',
      sub: 'They stay out of what’s safe to spend',
      go: () => router.navigate('/tracker'),
    },
    { done: scanned, title: 'Scan your first receipt', sub: '3 free scans, then Pro', go: () => router.navigate('/ai') },
  ];
  return (
    <View>
      <SectionHeader index={index} title="Start here" />
      <View style={{ marginTop: 12 }}>
        {steps.map((s, i) => (
          <Pressable
            key={s.title}
            onPress={s.go}
            accessibilityRole="button"
            accessibilityLabel={`${s.title}${s.done ? ', done' : ''}`}
            style={({ pressed }) => [styles.step, { opacity: pressed ? 0.5 : 1 }]}>
            <AppText variant="monoSmall" muted style={{ width: 30 }}>
              {s.done ? '✓' : i + 1}
            </AppText>
            <View style={{ flex: 1 }}>
              <AppText style={{ lineHeight: 20, textDecorationLine: s.done ? 'line-through' : 'none', color: s.done ? colors.grey : colors.ink }}>{s.title}</AppText>
              <AppText variant="small" muted>
                {s.sub}
              </AppText>
            </View>
            <Icon name="chevron" size={16} strokeWidth={1.5} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function Readout({ b, period, t, currency, nextPayOn }: { b: ChartBucket; period: Period; t: string; currency: string; nextPayOn: string | null }) {
  const isNow = t >= b.start && t <= b.end;
  const when =
    period === 'week'
      ? isNow
        ? 'Today'
        : formatDay(b.start, { weekday: 'long' })
      : period === 'month'
        ? isNow
          ? 'This week'
          : `${b.label} ${monthShort(b.start)}`
        : monthLong(b.start);
  const v = (c: number) => <AppText variant="caption">{formatMoney(c, currency)}</AppText>;
  const planned = nextPayOn && (isNow || (nextPayOn >= b.start && nextPayOn <= b.end));
  return (
    <>
      {when}: {v(b.need)} needs, {v(b.want)} wants{b.income > 0 ? <>, {v(b.income)} in</> : null}.
      {planned ? ` The dashed ring is your next pay, planned for the ${ordinal(parseISODate(nextPayOn).getDate())}.` : null}
    </>
  );
}

/** Income, spent and the share on needs for the period so far. */
function ShortStats({ txs, period, t, currency }: { txs: Tx[]; period: Period; t: string; currency: string }) {
  const { current } = comparePeriods(txs, period, t);
  const share = needsShare(current.need, current.want);
  const fig = (c: number) => formatFigure(c, currency);
  return (
    <View style={styles.stats}>
      <Stat label="Income">
        <CountUp cents={current.income} format={fig} />
      </Stat>
      <Stat label="Spent">
        <CountUp cents={current.spent} format={fig} />
      </Stat>
      <Stat label="On needs">
        <AppText variant="number">{share === null ? '—' : `${Math.round(share * 100)}%`}</AppText>
      </Stat>
    </View>
  );
}

function LongStats({ txs, range, currency }: { txs: Tx[]; range: { start: string; end: string }; currency: string }) {
  let income = 0;
  let spent = 0;
  for (const x of txs) {
    if (x.occurred_on < range.start || x.occurred_on > range.end) continue;
    if (x.type === 'income') income += x.amount_cents;
    else spent += x.amount_cents;
  }
  const fig = (c: number) => formatFigure(c, currency, { whole: true });
  return (
    <View style={styles.stats}>
      <Stat label="Income">
        <CountUp cents={income} format={fig} />
      </Stat>
      <Stat label="Spent">
        <CountUp cents={spent} format={fig} />
      </Stat>
      <Stat label="Kept">
        <CountUp cents={income - spent} format={fig} />
      </Stat>
    </View>
  );
}

/** One plain sentence about wants, and the next bill. */
function Lead({ txs, period, t, prevStart, recurring, currency }: { txs: Tx[]; period: Period; t: string; prevStart: string; recurring: Recurring[]; currency: string }) {
  const pct = wantsTrend(txs, period, t).changePct;
  const vs = period === 'week' ? 'last week' : `in ${monthLong(prevStart)}`;
  const bill = nextBill(recurring, t);
  const line =
    pct === null
      ? null
      : Math.abs(pct) <= LEVEL_PCT
        ? `Wants are about level with the same days ${vs}. Steady is good.`
        : pct < 0
          ? `Wants are ${Math.abs(pct)}% lower than on the same days ${vs}.`
          : `Wants are ${pct}% higher than on the same days ${vs}. A good week to pause the extras.`;
  if (!line && !bill) return null;
  return (
    <View>
      {line && <AppText variant="lead">{line}</AppText>}
      {bill && (
        <AppText muted style={{ marginTop: line ? 10 : 0, fontSize: 14, lineHeight: 20 }}>
          {bill.rule.label}, {formatMoney(bill.rule.amount_cents, currency)}, is due{' '}
          {bill.on === t
            ? 'today'
            : bill.on === addDays(t, 1)
              ? 'tomorrow'
              : `on ${formatDay(bill.on, { weekday: 'long' })} the ${ordinal(parseISODate(bill.on).getDate())}`}
          .
        </AppText>
      )}
    </View>
  );
}

function LongLead({ txs, buckets, range }: { txs: Tx[]; buckets: Bucket[]; range: { start: string; end: string } }) {
  let income = 0;
  let spent = 0;
  for (const x of txs) {
    if (x.occurred_on < range.start || x.occurred_on > range.end) continue;
    if (x.type === 'income') income += x.amount_cents;
    else spent += x.amount_cents;
  }
  const top = [...buckets].filter((b) => b.want > 0).sort((a, b) => b.want - a.want);
  const kept = income > 0 ? Math.round(((income - spent) / income) * 100) : null;
  if (kept === null && top.length === 0) return null;
  return (
    <View>
      {kept !== null && (
        <AppText variant="lead">{kept >= 0 ? `You kept ${kept}% of your pay.` : `You spent ${Math.abs(kept)}% more than you earned.`}</AppText>
      )}
      {top.length > 0 && (
        <AppText muted style={{ marginTop: 10, fontSize: 14, lineHeight: 20 }}>
          Wants were highest in {monthLong(top[0].start)}
          {top[1] ? `, then ${monthLong(top[1].start)}` : ''}.
        </AppText>
      )}
    </View>
  );
}

/** Top categories: a bar each, needs solid and wants hatched. */
function WhereItWent({ index, txs, range, settings }: { index: string; txs: Tx[]; range: { start: string; end: string }; settings: Settings }) {
  const rows = categoryBreakdown(txs, range.start, range.end).slice(0, 6);
  const all = categoryBreakdown(txs, range.start, range.end);
  const need = all.reduce((s, r) => s + r.need, 0);
  const total = all.reduce((s, r) => s + r.total, 0);
  const max = rows[0]?.total || 1;
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <SectionHeader index={index} title="Where it went" style={{ flex: 1 }} />
        {total > 0 && (
          <AppText variant="caption" muted>
            {Math.round((need / total) * 100)}% on needs
          </AppText>
        )}
      </View>
      {rows.length === 0 ? (
        <AppText muted style={{ marginTop: 16 }}>
          No spending in this stretch yet.
        </AppText>
      ) : (
        <View style={{ gap: 18, marginTop: 20 }}>
          {rows.map((r, i) => (
            <View key={r.category}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <AppText style={{ lineHeight: 20 }}>{categoryInfo(r.category, settings.customCategories).label}</AppText>
                <AppText variant="mono">{formatFigure(r.total, settings.currency)}</AppText>
              </View>
              <GrowX delay={i * motion.barStagger} style={{ flexDirection: 'row', height: 8, marginTop: 8, width: `${Math.max(2, (r.total / max) * 100)}%` }}>
                {r.need > 0 && <View style={{ flex: r.need, backgroundColor: colors.ink }} />}
                {r.want > 0 && (
                  <View style={{ flex: r.want, borderWidth: 1, borderColor: colors.ink, overflow: 'hidden' }}>
                    <Hatch gap={2.5} />
                  </View>
                )}
              </GrowX>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

/** The latest entries, by day. */
function Recent({ index, txs, settings }: { index: string; txs: Tx[]; settings: Settings }) {
  const t = today();
  const entrance = useEntrance();
  const recent = txs.filter((x) => x.occurred_on <= t).slice(0, 5);
  const days: { day: string; items: Tx[] }[] = [];
  for (const x of recent) {
    const last = days[days.length - 1];
    if (last?.day === x.occurred_on) last.items.push(x);
    else days.push({ day: x.occurred_on, items: [x] });
  }
  let row = 0;
  return (
    <View>
      <SectionHeader index={index} title="Recent" action={{ label: 'See all', onPress: () => router.navigate('/history') }} />
      {days.map((d) => {
        const total = d.items.reduce((s, x) => s + (x.type === 'income' ? x.amount_cents : -x.amount_cents), 0);
        return (
          <View key={d.day}>
            <DayHeader label={dayHeading(d.day, t)} total={total} currency={settings.currency} />
            <View style={{ marginTop: 4 }}>
              {d.items.map((x) => (
                <TxRow
                  key={x.id}
                  tx={x}
                  custom={settings.customCategories}
                  delay={entrance(row++)}
                  onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: x.id } })}
                />
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Footer() {
  const sync = useSync();
  const text =
    sync.status === 'local'
      ? 'Preview account · nothing syncs'
      : `Private to your account · ${sync.status === 'syncing' ? 'syncing…' : sync.status === 'offline' ? 'will sync when you’re online' : 'synced'}`;
  return (
    <View style={styles.footer}>
      <Icon name="lock" size={12} color={colors.grey} strokeWidth={1.75} />
      <AppText variant="small" muted>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  wideHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 },
  columns: { flexDirection: 'row', gap: 32, marginTop: 28, alignItems: 'flex-start' },
  topRule: { marginTop: 28, paddingTop: 24, borderTopWidth: 1, borderTopColor: colors.rule },
  step: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  stats: { flexDirection: 'row', gap: 16 },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 32 },
});
