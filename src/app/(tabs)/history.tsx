import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, SectionList, View } from 'react-native';

import { TxRow } from '@/components/money-ui';
import { AppText, Chip, EmptyState, Field, Row } from '@/components/ui';
import { useLiveQuery } from '@/db/live';
import { useSettings } from '@/db/settings';
import { listBetween, type Tx } from '@/db/transactions';
import { totals } from '@/lib/budget';
import { categoryInfo } from '@/lib/categories';
import { addMonths, endOfMonth, formatDay, formatMonth, startOfMonth, today } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { radius, space, useColors } from '@/theme/tokens';

type Filter = 'all' | 'expense' | 'income' | 'need' | 'want';
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'expense', label: 'Expenses' },
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
  const hay = `${tx.merchant ?? ''} ${tx.note ?? ''} ${label}`.toLowerCase();
  return hay.includes(q.toLowerCase());
}

export default function History() {
  const c = useColors();
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

  return (
    <SectionList
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl * 2, gap: 0 }}
      keyboardShouldPersistTaps="handled"
      sections={sections}
      keyExtractor={(tx) => tx.id}
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={
        <View style={{ gap: space.md, marginBottom: space.md }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Pressable onPress={() => setMonth(addMonths(month, -1, 1))} accessibilityLabel="Previous month" hitSlop={10}>
              <Ionicons name="chevron-back" size={24} color={c.primary} />
            </Pressable>
            <AppText variant="title">{formatMonth(month)}</AppText>
            <Pressable
              onPress={() => !isCurrentMonth && setMonth(addMonths(month, 1, 1))}
              accessibilityLabel="Next month"
              accessibilityState={{ disabled: isCurrentMonth }}
              hitSlop={10}>
              <Ionicons name="chevron-forward" size={24} color={isCurrentMonth ? c.border : c.primary} />
            </Pressable>
          </Row>
          <Row style={{ backgroundColor: c.surface, borderRadius: radius.md, padding: space.md, justifyContent: 'space-around' }}>
            <View style={{ alignItems: 'center' }}>
              <AppText variant="caption" muted>
                In
              </AppText>
              <AppText style={{ fontWeight: '700' }}>{formatMoney(tot.income, currency)}</AppText>
            </View>
            <View style={{ alignItems: 'center' }}>
              <AppText variant="caption" muted>
                Out
              </AppText>
              <AppText style={{ fontWeight: '700' }}>{formatMoney(tot.spent, currency)}</AppText>
            </View>
            <View style={{ alignItems: 'center' }}>
              <AppText variant="caption" muted>
                Wants
              </AppText>
              <AppText style={{ fontWeight: '700' }}>{formatMoney(tot.want, currency)}</AppText>
            </View>
          </Row>
          <Field value={query} onChangeText={setQuery} placeholder="Search merchant, note or category" clearButtonMode="while-editing" />
          <Row style={{ flexWrap: 'wrap' }}>
            {FILTERS.map((f) => (
              <Chip key={f.value} label={f.label} selected={filter === f.value} onPress={() => setFilter(f.value)} />
            ))}
          </Row>
        </View>
      }
      renderSectionHeader={({ section }) => {
        const out = section.data.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount_cents, 0);
        return (
          <Row style={{ justifyContent: 'space-between', marginTop: space.md, marginBottom: 2 }}>
            <AppText variant="caption" muted style={{ fontWeight: '700' }}>
              {formatDay(section.day)}
            </AppText>
            {out > 0 && (
              <AppText variant="caption" muted>
                −{formatMoney(out, currency)}
              </AppText>
            )}
          </Row>
        );
      }}
      renderItem={({ item }) => (
        <TxRow tx={item} custom={custom} onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: item.id } })} />
      )}
      ListEmptyComponent={
        txs ? (
          <EmptyState
            icon="receipt-outline"
            title={query || filter !== 'all' ? 'Nothing matches' : 'No entries this month'}
            body={query || filter !== 'all' ? 'Try another search or filter.' : 'Add expenses in Tracker or scan a receipt in AI mode.'}
          />
        ) : undefined
      }
    />
  );
}
