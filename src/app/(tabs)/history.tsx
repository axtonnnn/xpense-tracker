import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, SectionList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BlankPageSketch } from '@/components/illustrations';
import { TxRow } from '@/components/money-ui';
import { AppText, Chip, EmptyState, Field, IconButton, PageTitle, Row, tabular } from '@/components/ui';
import { useLiveQuery } from '@/db/live';
import { useSettings } from '@/db/settings';
import { listBetween, type Tx } from '@/db/transactions';
import { totals } from '@/lib/budget';
import { categoryInfo } from '@/lib/categories';
import { addDays, addMonths, endOfMonth, formatDay, startOfMonth, today } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { colors, READABLE_MAX, space } from '@/theme/tokens';

type Filter = 'all' | 'expense' | 'income' | 'need' | 'want';
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'expense', label: 'Spent' },
  { value: 'income', label: 'Income' },
  { value: 'need', label: 'Needs' },
  { value: 'want', label: 'Wants' },
];

function matches(tx: Tx, filter: Filter, q: string, label: string): boolean {
  if (filter === 'expense' && tx.type !== 'expense') return false;
  if (filter === 'income' && tx.type !== 'income') return false;
  if (filter === 'need' && (tx.type !== 'expense' || tx.need_cents <= 0)) return false;
  if (filter === 'want' && (tx.type !== 'expense' || tx.want_cents <= 0)) return false;
  if (!q) return true;
  const amount = (tx.amount_cents / 100).toFixed(2);
  const hay = `${tx.merchant ?? ''} ${tx.note ?? ''} ${label} ${amount}`.toLowerCase();
  return hay.includes(q.toLowerCase());
}

function dayLabel(day: string): string {
  const t = today();
  const short = formatDay(day, { weekday: 'short', day: 'numeric' });
  if (day === t) return `today, ${short}`;
  if (day === addDays(t, -1)) return `yesterday, ${short}`;
  return short;
}

export default function History() {
  const insets = useSafeAreaInsets();
  const settings = useSettings();
  const [month, setMonth] = useState(startOfMonth(today()));
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const from = month;
  const to = endOfMonth(month);
  const { data: txs } = useLiveQuery((db) => listBetween(db, from, to), [from, to]);
  const currency = settings?.currency ?? 'USD';
  const custom = settings?.customCategories;

  const sections = useMemo(() => {
    const byDay = new Map<string, Tx[]>();
    for (const tx of txs ?? []) {
      if (!matches(tx, filter, query.trim(), categoryInfo(tx.category, custom).label)) continue;
      const list = byDay.get(tx.occurred_on) ?? [];
      list.push(tx);
      byDay.set(tx.occurred_on, list);
    }
    return [...byDay.entries()].map(([day, data]) => ({ day, data }));
  }, [txs, filter, query, custom]);

  const tot = totals(txs ?? [], from, to);
  const isCurrentMonth = month === startOfMonth(today());
  const filtered = query.trim() !== '' || filter !== 'all';
  const monthName = new Date(`${month}T12:00:00`).toLocaleDateString(undefined, { month: 'long', year: isCurrentMonth ? undefined : 'numeric' });

  return (
    <SectionList
      style={{ flex: 1, backgroundColor: colors.paper }}
      contentContainerStyle={{ paddingHorizontal: 24, paddingTop: insets.top + space.md, paddingBottom: 120, width: '100%', maxWidth: READABLE_MAX + 48, alignSelf: 'center' }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      sections={sections}
      keyExtractor={(tx) => tx.id}
      stickySectionHeadersEnabled={false}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <View style={{ gap: 18, marginBottom: space.xs }}>
          <PageTitle
            title="History"
            right={
              <Row style={{ gap: 0, marginBottom: 4 }}>
                <IconButton icon="chevron-back" label="Previous month" size={34} onPress={() => setMonth(addMonths(month, -1, 1))} />
                <AppText weight="semibold" style={{ fontSize: 15 }}>
                  {monthName}
                </AppText>
                <View style={{ opacity: isCurrentMonth ? 0.25 : 1 }}>
                  <IconButton icon="chevron-forward" label="Next month" size={34} onPress={() => !isCurrentMonth && setMonth(addMonths(month, 1, 1))} />
                </View>
              </Row>
            }
          />
          <Field
            value={query}
            onChangeText={setQuery}
            placeholder="Search shops, notes, amounts"
            clearButtonMode="while-editing"
            right={<Ionicons name="search" size={18} color={colors.graphite} />}
          />
          {/* Bleed to the screen edges so it is obvious the chips scroll. */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -24 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 24 }}>
            {FILTERS.map((f) => (
              <Chip key={f.value} label={f.label} selected={filter === f.value} onPress={() => setFilter(f.value)} />
            ))}
          </ScrollView>
          <Row style={{ gap: 18 }}>
            <AppText variant="caption" muted>
              Out{' '}
              <AppText variant="caption" weight="semibold" style={tabular}>
                {formatMoney(tot.spent, currency)}
              </AppText>
            </AppText>
            <AppText variant="caption" muted>
              In{' '}
              <AppText variant="caption" weight="semibold" style={tabular}>
                {formatMoney(tot.income, currency)}
              </AppText>
            </AppText>
            <AppText variant="caption" muted>
              {txs?.length ?? 0} {txs?.length === 1 ? 'entry' : 'entries'}
            </AppText>
          </Row>
        </View>
      }
      renderSectionHeader={({ section }) => {
        const net = section.data.reduce((s, t) => s + (t.type === 'income' ? t.amount_cents : -t.amount_cents), 0);
        return (
          <Row style={{ justifyContent: 'space-between', alignItems: 'baseline', marginTop: space.md }}>
            <AppText variant="note" muted style={{ fontSize: 22 }}>
              {dayLabel(section.day)}
            </AppText>
            <AppText variant="note" muted style={[tabular, { fontSize: 19 }]}>
              {net >= 0 ? '+' : '−'}
              {formatMoney(Math.abs(net), currency)}
            </AppText>
          </Row>
        );
      }}
      renderItem={({ item, index, section }) => (
        <TxRow
          tx={item}
          custom={custom}
          last={index === section.data.length - 1}
          onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: item.id } })}
        />
      )}
      ListEmptyComponent={
        txs ? (
          <EmptyState
            illustration={<BlankPageSketch width={170} />}
            title={filtered ? 'Nothing matches' : 'A blank page'}
            body={filtered ? 'Try another search or filter.' : 'Add what you spend in Tracker, or scan a receipt in AI mode.'}
          />
        ) : undefined
      }
    />
  );
}
