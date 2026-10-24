import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, SectionList, StyleSheet, View } from 'react-native';

import { LeafSearch } from '@/components/illustrations';
import { TxRow } from '@/components/money-ui';
import { AppText, Card, Chip, EmptyState, Field, IconButton, Row } from '@/components/ui';
import { useLiveQuery } from '@/db/live';
import { useSettings } from '@/db/settings';
import { listBetween, type Tx } from '@/db/transactions';
import { totals } from '@/lib/budget';
import { categoryInfo } from '@/lib/categories';
import { addMonths, endOfMonth, formatDay, formatMonth, startOfMonth, today } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { elevation, radius, space, useColors, useIsDark } from '@/theme/tokens';

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
  const dark = useIsDark();
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

  return (
    <SectionList
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ padding: space.lg, paddingBottom: 120 }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      sections={sections}
      keyExtractor={(tx) => tx.id}
      stickySectionHeadersEnabled={false}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <View style={{ gap: space.md, marginBottom: space.sm }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <IconButton icon="chevron-back" label="Previous month" onPress={() => setMonth(addMonths(month, -1, 1))} />
            <AppText variant="title">{formatMonth(month)}</AppText>
            <View style={{ opacity: isCurrentMonth ? 0.35 : 1 }}>
              <IconButton icon="chevron-forward" label="Next month" onPress={() => !isCurrentMonth && setMonth(addMonths(month, 1, 1))} />
            </View>
          </Row>
          <Card style={{ flexDirection: 'row', paddingVertical: space.md }}>
            <Summary label="In" value={formatMoney(tot.income, currency)} color={c.positive} />
            <View style={[styles.vr, { backgroundColor: c.border }]} />
            <Summary label="Out" value={formatMoney(tot.spent, currency)} />
            <View style={[styles.vr, { backgroundColor: c.border }]} />
            <Summary label="Wants" value={formatMoney(tot.want, currency)} color={c.wantInk} />
          </Card>
          <Field icon="search" value={query} onChangeText={setQuery} placeholder="Search merchant, note or category" clearButtonMode="while-editing" />
          {/* Bleed to the screen edges so it is obvious the chips scroll. */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -space.lg }}
            contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.lg }}>
            {FILTERS.map((f) => (
              <Chip key={f.value} label={f.label} selected={filter === f.value} onPress={() => setFilter(f.value)} />
            ))}
          </ScrollView>
        </View>
      }
      renderSectionHeader={({ section }) => {
        const out = section.data.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount_cents, 0);
        return (
          <Row style={{ justifyContent: 'space-between', marginTop: space.lg, marginBottom: space.xs, paddingHorizontal: space.xs }}>
            <AppText variant="label" muted>
              {formatDay(section.day)}
            </AppText>
            {out > 0 && (
              <AppText variant="caption" weight="semibold" muted>
                −{formatMoney(out, currency)}
              </AppText>
            )}
          </Row>
        );
      }}
      renderItem={({ item, index, section }) => (
        <View
          style={[
            styles.rowCard,
            { backgroundColor: c.surface },
            index === 0 && styles.first,
            index === section.data.length - 1 && styles.last,
            dark && { borderLeftWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth, borderColor: c.border },
            dark && index === 0 && { borderTopWidth: StyleSheet.hairlineWidth },
            dark && index === section.data.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth },
            !dark && index === section.data.length - 1 && elevation(false),
          ]}>
          {index > 0 && <View style={[styles.sep, { backgroundColor: c.border }]} />}
          <TxRow tx={item} custom={custom} onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: item.id } })} />
        </View>
      )}
      ListEmptyComponent={
        txs ? (
          <EmptyState
            illustration={<LeafSearch />}
            title={filtered ? 'Nothing matches' : 'No entries this month'}
            body={filtered ? 'Try another search or filter.' : 'Add expenses in Tracker or scan a receipt in AI mode.'}
          />
        ) : undefined
      }
    />
  );
}

function Summary({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <AppText variant="label" muted>
        {label}
      </AppText>
      <AppText weight="extrabold" color={color} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  rowCard: { paddingHorizontal: space.md },
  first: { borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md, paddingTop: 2 },
  last: { borderBottomLeftRadius: radius.md, borderBottomRightRadius: radius.md, paddingBottom: 2 },
  sep: { height: StyleSheet.hairlineWidth, marginLeft: 64 },
  vr: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
});
