import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { BlankPageSketch } from '@/components/illustrations';
import { SafeToSpendCard, StatTile, TxRow, type Delta } from '@/components/money-ui';
import { ProgressChart } from '@/components/ProgressChart';
import { SketchCircle, SketchRule, SplitBar } from '@/components/sketch';
import { AppText, Button, Card, EmptyState, ProTag, Row, Screen, SectionTitle, tabular, TextTabs } from '@/components/ui';
import { useLiveQuery } from '@/db/live';
import { listRecurring } from '@/db/recurring';
import { useSettings, type Settings } from '@/db/settings';
import { useSync } from '@/db/SyncProvider';
import { listBetween, type Tx } from '@/db/transactions';
import { useUser } from '@/lib/auth';
import {
  categoryBreakdown,
  chartSeries,
  comparePeriods,
  needsShare,
  pctChange,
  periodRange,
  previousRange,
  PRO_PERIODS,
  safeToSpend,
  totals,
  wantsTrend,
  type Bucket,
  type Period,
} from '@/lib/budget';
import { categoryInfo } from '@/lib/categories';
import { endOfMonth, formatDay, formatMonth, parseISODate, startOfMonth, today } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { usePro, useRequirePro } from '@/lib/pro';
import { colors, fonts, space, useWide } from '@/theme/tokens';

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

function periodTitle(period: Period, t: string): string {
  if (period === 'week') return 'This week';
  if (period === 'month') return parseISODate(t).toLocaleDateString(undefined, { month: 'long' });
  return period === '6m' ? 'Six months' : 'This year';
}

function vsLabel(period: Period, prevStart: string): string {
  if (period === 'week') return 'last week';
  if (period === 'month') return parseISODate(prevStart).toLocaleDateString(undefined, { month: 'long' });
  return period === '6m' ? 'the six before' : 'the year before';
}

function bucketTitle(period: Period, b: Bucket): string {
  if (period === 'week') return formatDay(b.start, { weekday: 'long', day: 'numeric' });
  if (period === 'month') return `Week of ${b.label}`;
  return formatMonth(b.start);
}

export default function Dashboard() {
  const settings = useSettings();
  const user = useUser();
  const sync = useSync();
  const wide = useWide();
  const { isPro } = usePro();
  const requirePro = useRequirePro();
  const [period, setPeriod] = useState<Period>('month');
  const [picked, setPicked] = useState<{ period: Period; index: number } | null>(null);
  const t = today();

  const range = periodRange(period, t);
  const prev = previousRange(period, t);
  const from = [prev.start, startOfMonth(t)].sort()[0];
  const to = [range.end, endOfMonth(t)].sort()[1];
  const { data: txs } = useLiveQuery((db) => listBetween(db, from, to), [from, to]);
  const { data: recurring } = useLiveQuery(listRecurring, []);

  if (!txs || !settings || !recurring) return <Screen>{null}</Screen>;

  const currency = settings.currency;
  const buckets = chartSeries(txs, period, t);
  const current = Math.max(0, buckets.findIndex((b) => t >= b.start && t <= b.end));
  const selected = picked?.period === period ? picked.index : current;
  const { current: cur, previous: was } = comparePeriods(txs, period, t);
  const month = totals(txs, startOfMonth(t), endOfMonth(t));
  const safe = safeToSpend({
    today: t,
    txs,
    expectedIncomeCents: settings.monthlyIncomeCents,
    savingsGoalCents: settings.savingsGoalCents,
    recurring,
  });
  const wantsPct = wantsTrend(txs, period, t).changePct;
  const breakdown = categoryBreakdown(txs, range.start, range.end).slice(0, 6);
  const vs = vsLabel(period, prev.start);
  const share = needsShare(cur.need, cur.want);
  const prevShare = needsShare(was.need, was.want);
  const sharePts = share !== null && prevShare !== null ? Math.round((share - prevShare) * 100) : null;
  const delta = (now: number, before: number, goodWhenUp: boolean): Delta => ({ pct: pctChange(now, before), goodWhenUp, vs });
  const isEmpty = txs.length === 0;
  const name = settings.name || user.name || '';
  const paychecks = txs.filter((x) => x.type === 'income' && x.occurred_on >= range.start && x.occurred_on <= t).length;
  const entries = txs.filter((x) => x.occurred_on >= range.start && x.occurred_on <= t).length;

  const choosePeriod = (p: Period) => {
    if (PRO_PERIODS.includes(p) && !requirePro('long_range_charts')) return;
    setPeriod(p);
  };

  const header = (
    <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
      <View style={{ flexShrink: 1 }}>
        <AppText variant="note" muted numberOfLines={1}>
          {greeting(name)}
        </AppText>
        <AppText variant="display" accessibilityRole="header" style={wide ? { fontSize: 52, lineHeight: 56 } : undefined}>
          {periodTitle(period, t)}
        </AppText>
      </View>
      {wide ? (
        <Button title="+ Add entry" onPress={() => router.navigate('/tracker')} style={{ minHeight: 44 }} />
      ) : (
        <Pressable onPress={() => router.push('/settings')} accessibilityRole="button" accessibilityLabel="Account and settings" hitSlop={8}>
          <SketchCircle size={40} seed={83}>
            <Text style={{ fontFamily: fonts.serif, fontSize: 22, color: colors.ink }}>{(name || user.email || 'X').slice(0, 1).toUpperCase()}</Text>
          </SketchCircle>
        </Pressable>
      )}
    </Row>
  );

  const tabs = <TextTabs options={PERIODS} value={period} onChange={choosePeriod} locked={isPro ? [] : PRO_PERIODS} />;

  const safeCard = (
    <SafeToSpendCard safe={safe} spent={{ need: month.need, want: month.want }} savingsGoalCents={settings.savingsGoalCents} currency={currency} onSetup={() => router.push('/settings')} />
  );

  const chartCard = (
    <Card seed="dashboard-chart" style={{ gap: 14 }}>
      {isEmpty ? (
        <EmptyState
          illustration={<BlankPageSketch width={170} />}
          title="Nothing written down yet"
          body="Add what you spend and earn, or scan a receipt and let the AI do the typing. Your chart fills in as you go."
          action={
            <Row style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
              <Button title="Add an entry" onPress={() => router.navigate('/tracker')} />
              <Button title="Scan a receipt" kind="secondary" onPress={() => router.navigate('/ai')} />
            </Row>
          }
        />
      ) : (
        <ProgressChart
          buckets={buckets}
          currency={currency}
          selected={selected}
          onSelect={(index) => setPicked({ period, index })}
          incomeLine={period === '6m' || period === '1y'}
          title={(b) => bucketTitle(period, b)}
        />
      )}
    </Card>
  );

  const tiles = (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
      <StatTile label="Income" value={formatMoney(cur.income, currency)} sub={paychecks ? `${paychecks} ${paychecks === 1 ? 'paycheck' : 'paychecks'} so far` : 'nothing in yet'} />
      <StatTile label="Spent" value={formatMoney(cur.spent, currency)} sub={`${entries} ${entries === 1 ? 'entry' : 'entries'}`} delta={delta(cur.spent, was.spent, false)} />
      <StatTile label="Saved" value={formatMoney(cur.saved, currency)} sub="so far" />
      <StatTile
        label="Needs"
        value={share === null ? '—' : `${Math.round(share * 100)}%`}
        sub="of what you spent"
        delta={sharePts === null ? undefined : { pct: sharePts, goodWhenUp: true, vs, suffix: Math.abs(sharePts) === 1 ? ' pt' : ' pts' }}
      />
    </View>
  );

  const trend =
    wantsPct !== null ? (
      <View style={{ gap: 6 }}>
        <Row style={{ gap: 12, alignItems: 'flex-start' }}>
          <Ionicons
            name={Math.abs(wantsPct) <= LEVEL_PCT ? 'remove-outline' : wantsPct < 0 ? 'arrow-down-outline' : 'arrow-up-outline'}
            size={21}
            color={colors.ink}
            style={{ marginTop: 1 }}
          />
          <AppText style={{ flex: 1, fontSize: 15, lineHeight: 22 }}>
            {Math.abs(wantsPct) <= LEVEL_PCT ? (
              `Wants are about level with ${vs}. Steady is good.`
            ) : wantsPct < 0 ? (
              <>
                Wants are down <AppText weight="semibold">{Math.abs(wantsPct)}%</AppText> on the same days {period === 'week' ? 'last week' : `in ${vs}`}.
              </>
            ) : (
              <>
                Wants are up <AppText weight="semibold">{wantsPct}%</AppText> on the same days {period === 'week' ? 'last week' : `in ${vs}`}. A good week to
                pause the extras.
              </>
            )}
          </AppText>
        </Row>
        <SketchRule seed={21} opacity={0.3} />
      </View>
    ) : null;

  const whereItWent = (
    <View style={{ gap: 16 }}>
      <SectionTitle note={share !== null && isPro ? `${Math.round(share * 100)}% on needs` : undefined}>Where it went</SectionTitle>
      {isPro ? (
        breakdown.length === 0 ? (
          <AppText muted>No spending in this period yet.</AppText>
        ) : (
          breakdown.map((b) => {
            const max = breakdown[0].total || 1;
            return (
              <View key={b.category} style={{ gap: 7 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <AppText style={{ fontSize: 15 }}>{categoryInfo(b.category, settings.customCategories).label}</AppText>
                  <AppText weight="semibold" style={[tabular, { fontSize: 15 }]}>
                    {formatMoney(b.total, currency)}
                  </AppText>
                </Row>
                <SplitBar need={b.need} want={b.want} style={{ width: `${Math.max(2, (b.total / max) * 100)}%` }} />
              </View>
            );
          })
        )
      ) : (
        <Pressable onPress={() => requirePro('category_breakdown')} accessibilityRole="button" style={{ gap: 6 }}>
          <AppText muted>
            See your top categories split into needs and wants, plus six-month and yearly trends. <ProTag />
          </AppText>
          <AppText style={{ textDecorationLine: 'underline' }}>See Xpense Pro</AppText>
        </Pressable>
      )}
    </View>
  );

  const footer = (
    <Row style={{ justifyContent: 'center', gap: 8, paddingTop: 6 }}>
      <Ionicons name="lock-closed-outline" size={13} color={colors.pencil} />
      <AppText variant="caption" faint style={{ fontSize: 12 }}>
        {sync.status === 'local'
          ? 'Preview account · nothing syncs'
          : `Private to your account · ${sync.status === 'syncing' ? 'syncing…' : sync.status === 'offline' ? 'will sync when you’re online' : 'synced'}`}
      </AppText>
    </Row>
  );

  if (wide) {
    return (
      <Screen full topInset contentStyle={{ paddingHorizontal: 40, gap: 22 }}>
        {header}
        {tabs}
        <View style={{ flexDirection: 'row', gap: 28, alignItems: 'flex-start' }}>
          <View style={{ flex: 1, gap: 22 }}>
            {safeCard}
            {chartCard}
            {trend}
          </View>
          <View style={{ flex: 1, gap: 22 }}>
            {tiles}
            <RecentList txs={txs} settings={settings} />
            {whereItWent}
          </View>
        </View>
        {footer}
      </Screen>
    );
  }

  return (
    <Screen topInset>
      {header}
      {tabs}
      {safeCard}
      {chartCard}
      {tiles}
      {trend}
      {whereItWent}
      {footer}
    </Screen>
  );
}

/** iPad and Mac: the latest entries next to the chart. */
function RecentList({ txs, settings }: { txs: Tx[]; settings: Settings }) {
  const recent = txs.filter((x) => x.occurred_on <= today()).slice(0, 7);
  return (
    <View>
      <SectionTitle action={{ label: 'All history', onPress: () => router.navigate('/history') }}>Recent</SectionTitle>
      {recent.length === 0 ? (
        <AppText muted style={{ marginTop: space.sm }}>
          Nothing yet this month.
        </AppText>
      ) : (
        recent.map((tx, i) => (
          <TxRow
            key={tx.id}
            tx={tx}
            custom={settings.customCategories}
            showDate
            last={i === recent.length - 1}
            onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: tx.id } })}
          />
        ))
      )}
    </View>
  );
}
