import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Logo } from '@/components/brand';
import { CoinSprout } from '@/components/illustrations';
import { CategoryIcon, SafeToSpendCard, StatTile, type Delta } from '@/components/money-ui';
import { ProgressChart } from '@/components/ProgressChart';
import { AppText, Banner, Button, Card, EmptyState, IconButton, ProBadge, Row, Screen, Segmented } from '@/components/ui';
import { useLiveQuery } from '@/db/live';
import { listRecurring } from '@/db/recurring';
import { useSettings } from '@/db/settings';
import { listBetween } from '@/db/transactions';
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
  wantsTrend,
  type Period,
} from '@/lib/budget';
import { categoryInfo } from '@/lib/categories';
import { endOfMonth, formatDay, parseISODate, startOfMonth, today } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { usePro, useRequirePro } from '@/lib/pro';
import { space, useColors } from '@/theme/tokens';

const PERIODS: { value: Period; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: '6m', label: '6 months' },
  { value: '1y', label: '1 year' },
];

/** Changes this small (in %) read as "about level" rather than up or down. */
const LEVEL_PCT = 2;

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function periodTitle(period: Period, t: string): string {
  if (period === 'week') return 'This week';
  if (period === 'month') return parseISODate(t).toLocaleDateString(undefined, { month: 'long' });
  return period === '6m' ? 'Last 6 months' : 'Last 12 months';
}

function vsLabel(period: Period, prevStart: string): string {
  if (period === 'week') return 'last week';
  if (period === 'month') return parseISODate(prevStart).toLocaleDateString(undefined, { month: 'short' });
  return period === '6m' ? 'prior 6 mo' : 'prior year';
}

export default function Dashboard() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const settings = useSettings();
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

  const currency = settings?.currency ?? 'USD';
  // Derived each render; the React Compiler memoizes this.
  const buckets = txs ? chartSeries(txs, period, t) : null;
  const view =
    txs && settings && recurring && buckets
      ? {
          buckets,
          current: Math.max(0, buckets.findIndex((b) => t >= b.start && t <= b.end)),
          cmp: comparePeriods(txs, period, t),
          safe: safeToSpend({
            today: t,
            txs,
            expectedIncomeCents: settings.monthlyIncomeCents,
            savingsGoalCents: settings.savingsGoalCents,
            recurring,
          }),
          trend: wantsTrend(txs, period, t),
          breakdown: categoryBreakdown(txs, range.start, range.end).slice(0, 5),
        }
      : null;

  if (!view || !settings) return <Screen>{null}</Screen>;

  const selected = picked?.period === period ? picked.index : view.current;
  const { current: cur, previous: was } = view.cmp;
  const vs = vsLabel(period, prev.start);
  const share = needsShare(cur.need, cur.want);
  const prevShare = needsShare(was.need, was.want);
  const sharePts = share !== null && prevShare !== null ? Math.round((share - prevShare) * 100) : null;
  const delta = (now: number, before: number, goodWhenUp: boolean): Delta => ({ pct: pctChange(now, before), goodWhenUp, vs });
  const isEmpty = txs?.length === 0;
  const wantsPct = view.trend.changePct;

  const choosePeriod = (p: Period) => {
    if (PRO_PERIODS.includes(p) && !requirePro('long_range_charts')) return;
    setPeriod(p);
  };

  return (
    <Screen contentStyle={{ paddingTop: insets.top + space.sm }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Logo size={26} />
        <IconButton icon="settings-outline" label="Settings" onPress={() => router.push('/settings')} />
      </Row>

      <View style={{ gap: 2 }}>
        <AppText variant="caption" weight="semibold" muted>
          {greeting()}
        </AppText>
        <AppText variant="display" accessibilityRole="header">
          {periodTitle(period, t)}
        </AppText>
      </View>

      <Segmented options={PERIODS} value={period} onChange={choosePeriod} locked={isPro ? [] : PRO_PERIODS} />

      <Card>
        <Row style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <AppText variant="title">Your progress</AppText>
          <AppText variant="caption" weight="semibold" muted>
            {formatDay(range.start, { month: 'short', day: 'numeric' })} – {formatDay(range.end, { month: 'short', day: 'numeric' })}
          </AppText>
        </Row>
        {isEmpty ? (
          <EmptyState
            illustration={<CoinSprout />}
            title="Let’s grow your savings"
            body="Add an expense or income, or scan a receipt and let AI do the typing. Your chart fills in as you go."
            action={
              <Row>
                <Button title="Add entry" icon="add" onPress={() => router.navigate('/tracker')} />
                <Button title="Scan" icon="scan" kind="secondary" onPress={() => router.navigate('/ai')} />
              </Row>
            }
          />
        ) : (
          <ProgressChart
            buckets={view.buckets}
            currency={currency}
            selected={selected}
            onSelect={(index) => setPicked({ period, index })}
            incomeLine={period === '6m' || period === '1y'}
          />
        )}
      </Card>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
        <StatTile label="Income" icon="trending-up" value={formatMoney(cur.income, currency)} delta={delta(cur.income, was.income, true)} />
        <StatTile label="Spent" icon="card-outline" value={formatMoney(cur.spent, currency)} delta={delta(cur.spent, was.spent, false)} />
        <StatTile label="Saved" icon="leaf-outline" value={formatMoney(cur.saved, currency)} delta={delta(cur.saved, was.saved, true)} />
        <StatTile
          label="Spent on needs"
          icon="shield-checkmark-outline"
          value={share === null ? '—' : `${Math.round(share * 100)}%`}
          delta={{ pct: sharePts, goodWhenUp: true, vs, suffix: Math.abs(sharePts ?? 0) === 1 ? ' pt' : ' pts' }}
        />
      </View>

      {wantsPct !== null && (
        <Banner tone={wantsPct <= LEVEL_PCT ? 'success' : 'warn'} icon={wantsPct <= LEVEL_PCT ? 'leaf' : 'trending-up'}>
          {Math.abs(wantsPct) <= LEVEL_PCT
            ? `Wants are about level with ${vs}. Steady is good.`
            : wantsPct < 0
              ? `Wants are down ${Math.abs(wantsPct)}% vs ${vs}. Nice conserving!`
              : `Wants are up ${wantsPct}% vs ${vs}. A good time to pause the extras.`}
        </Banner>
      )}

      <SafeToSpendCard safe={view.safe} currency={currency} onSetup={() => router.push('/settings')} />

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <AppText variant="title">Where it went</AppText>
          {!isPro && <ProBadge />}
        </Row>
        {isPro ? (
          view.breakdown.length === 0 ? (
            <AppText muted>No spending in this period yet.</AppText>
          ) : (
            view.breakdown.map((b) => {
              const max = view.breakdown[0].total || 1;
              const info = categoryInfo(b.category, settings.customCategories);
              return (
                <Row key={b.category} style={{ gap: space.md }}>
                  <CategoryIcon category={b.category} custom={settings.customCategories} necessity={b.need >= b.want ? 'need' : 'want'} size={36} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <Row style={{ justifyContent: 'space-between' }}>
                      <AppText weight="semibold">{info.label}</AppText>
                      <AppText weight="bold">{formatMoney(b.total, currency)}</AppText>
                    </Row>
                    <View style={{ flexDirection: 'row', height: 6, width: `${(b.total / max) * 100}%`, gap: b.need && b.want ? 2 : 0 }}>
                      {b.need > 0 && <View style={{ flex: b.need, backgroundColor: c.need, borderRadius: 3 }} />}
                      {b.want > 0 && <View style={{ flex: b.want, backgroundColor: c.want, borderRadius: 3 }} />}
                    </View>
                  </View>
                </Row>
              );
            })
          )
        ) : (
          <>
            <AppText muted>See your top categories split into needs and wants, plus 6-month and yearly trends.</AppText>
            <Button title="Unlock with Pro" kind="secondary" icon="sparkles" onPress={() => requirePro('category_breakdown')} />
          </>
        )}
      </Card>

      <Row style={{ justifyContent: 'center', gap: 6, opacity: 0.7 }}>
        <Ionicons name="lock-closed" size={12} color={c.inkMuted} />
        <AppText variant="caption" muted>
          Your data stays on this phone
        </AppText>
      </Row>
    </Screen>
  );
}
