import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { ShieldCard, StatTile } from '@/components/money-ui';
import { ProgressChart } from '@/components/ProgressChart';
import { AppText, Button, Card, EmptyState, ProBadge, Row, Screen, Segmented } from '@/components/ui';
import { useLiveQuery } from '@/db/live';
import { listRecurring } from '@/db/recurring';
import { useSettings } from '@/db/settings';
import { listBetween } from '@/db/transactions';
import {
  categoryBreakdown,
  chartSeries,
  needsShare,
  periodRange,
  previousRange,
  PRO_PERIODS,
  safeToSpend,
  totals,
  wantsTrend,
  type Period,
} from '@/lib/budget';
import { categoryInfo } from '@/lib/categories';
import { endOfMonth, startOfMonth, today } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { usePro, useRequirePro } from '@/lib/pro';
import { space, useColors } from '@/theme/tokens';

const PERIODS: { value: Period; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: '6m', label: '6 months' },
  { value: '1y', label: '1 year' },
];

const PERIOD_NOUN: Record<Period, string> = { week: 'last week', month: 'last month', '6m': 'the 6 months before', '1y': 'the year before' };

export default function Dashboard() {
  const c = useColors();
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
  const view = useMemo(() => {
    if (!txs || !settings || !recurring) return null;
    const buckets = chartSeries(txs, period, t);
    const current = Math.max(0, buckets.findIndex((b) => t >= b.start && t <= b.end));
    return {
      buckets,
      current,
      tot: totals(txs, range.start, range.end),
      safe: safeToSpend({
        today: t,
        txs,
        expectedIncomeCents: settings.monthlyIncomeCents,
        savingsGoalCents: settings.savingsGoalCents,
        recurring,
      }),
      trend: wantsTrend(txs, period, t),
      breakdown: categoryBreakdown(txs, range.start, range.end).slice(0, 5),
    };
  }, [txs, settings, recurring, period, t, range.start, range.end]);

  if (!view || !settings) return <Screen>{null}</Screen>;

  const selected = picked?.period === period ? picked.index : view.current;
  const share = needsShare(view.tot.need, view.tot.want);
  const isEmpty = txs?.length === 0;

  const choosePeriod = (p: Period) => {
    if (PRO_PERIODS.includes(p) && !requirePro('long_range_charts')) return;
    setPeriod(p);
  };

  return (
    <Screen>
      <Segmented options={PERIODS} value={period} onChange={choosePeriod} locked={isPro ? [] : PRO_PERIODS} />

      <Card>
        <AppText variant="title">Your progress</AppText>
        <ProgressChart
          buckets={view.buckets}
          currency={currency}
          selected={selected}
          onSelect={(index) => setPicked({ period, index })}
          incomeLine={period === '6m' || period === '1y'}
        />
      </Card>

      {isEmpty && (
        <Card>
          <EmptyState
            icon="leaf-outline"
            title="Let's start growing your savings"
            body="Add an expense or income, or scan a receipt and let AI do the typing."
            action={
              <Row>
                <Button title="Add entry" icon="add" onPress={() => router.navigate('/tracker')} />
                <Button title="Scan" icon="camera-outline" kind="secondary" onPress={() => router.navigate('/ai')} />
              </Row>
            }
          />
        </Card>
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
        <StatTile label="Income" value={formatMoney(view.tot.income, currency)} />
        <StatTile label="Spent" value={formatMoney(view.tot.spent, currency)} />
        <StatTile label="Saved" value={formatMoney(view.tot.saved, currency)} />
        <StatTile label="Spent on needs" value={share === null ? '—' : `${Math.round(share * 100)}%`} />
      </View>

      {view.trend.changePct !== null && (
        <Row style={{ paddingHorizontal: space.xs }}>
          <Ionicons
            name={view.trend.changePct <= 0 ? 'leaf' : 'trending-up'}
            size={18}
            color={view.trend.changePct <= 0 ? c.need : c.want}
          />
          <AppText style={{ flex: 1 }}>
            {view.trend.changePct === 0
              ? `Wants are level with ${PERIOD_NOUN[period]}`
              : `Wants ${view.trend.changePct < 0 ? 'down' : 'up'} ${Math.abs(view.trend.changePct)}% vs ${PERIOD_NOUN[period]}`}
          </AppText>
        </Row>
      )}

      <ShieldCard safe={view.safe} currency={currency} onSetup={() => router.push('/settings')} />

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
                <View key={b.category} style={{ gap: 6 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Row>
                      <Ionicons name={info.icon} size={16} color={c.inkMuted} />
                      <AppText>{info.label}</AppText>
                    </Row>
                    <AppText style={{ fontWeight: '700' }}>{formatMoney(b.total, currency)}</AppText>
                  </Row>
                  <View style={{ flexDirection: 'row', height: 8, width: `${(b.total / max) * 100}%`, gap: b.need && b.want ? 2 : 0 }}>
                    {b.need > 0 && <View style={{ flex: b.need, backgroundColor: c.need, borderRadius: 4 }} />}
                    {b.want > 0 && <View style={{ flex: b.want, backgroundColor: c.want, borderRadius: 4 }} />}
                  </View>
                </View>
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
    </Screen>
  );
}
