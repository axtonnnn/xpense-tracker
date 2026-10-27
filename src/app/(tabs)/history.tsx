import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, SectionList, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EntryDetail } from '@/components/EntryDetail';
import { Icon } from '@/components/icons';
import { useEntrance } from '@/components/motion';
import { DayHeader, TxRow } from '@/components/money-ui';
import { EmptyPage } from '@/components/pictures';
import { AppText, Chip, EmptyState, IconButton, TextLink, useMargin } from '@/components/ui';
import { useLiveQuery } from '@/db/live';
import { useSettings, type Settings } from '@/db/settings';
import { listBetween, type Tx } from '@/db/transactions';
import { totals } from '@/lib/budget';
import { categoryInfo } from '@/lib/categories';
import { addMonths, dayHeading, endOfMonth, parseISODate, startOfMonth, today } from '@/lib/dates';
import { formatFigure } from '@/lib/money';
import { colors, fonts, READABLE_MAX, useWide, WIDE_MARGIN } from '@/theme/tokens';

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

export default function History() {
  const settings = useSettings();
  const wide = useWide();
  const [month, setMonth] = useState(startOfMonth(today()));
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  if (!settings) return <View style={{ flex: 1, backgroundColor: colors.paper }} />;

  const list = (
    <HistoryList
      key={month}
      month={month}
      setMonth={setMonth}
      filter={filter}
      setFilter={setFilter}
      query={query}
      setQuery={setQuery}
      settings={settings}
      selected={wide ? selected : null}
      onOpen={(id) => (wide ? setSelected(id) : router.push({ pathname: '/transaction/[id]', params: { id } }))}
    />
  );

  if (!wide) return list;
  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.paper }}>
      <View style={styles.listColumn}>{list}</View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.detail} keyboardShouldPersistTaps="handled">
        {selected ? (
          <View style={{ width: '100%', maxWidth: READABLE_MAX }}>
            <EntryDetail key={selected} id={selected} onDone={() => setSelected(null)} />
          </View>
        ) : (
          <EmptyState picture={<EmptyPage />} title="Pick an entry" body="Its details, receipt and need or want lines show here." />
        )}
      </ScrollView>
    </View>
  );
}

function HistoryList({
  month,
  setMonth,
  filter,
  setFilter,
  query,
  setQuery,
  settings,
  selected,
  onOpen,
}: {
  month: string;
  setMonth: (m: string) => void;
  filter: Filter;
  setFilter: (f: Filter) => void;
  query: string;
  setQuery: (q: string) => void;
  settings: Settings;
  selected: string | null;
  onOpen: (id: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const margin = useMargin();
  const wide = useWide();
  const entrance = useEntrance(14);
  const from = month;
  const to = endOfMonth(month);
  const { data: txs } = useLiveQuery((db) => listBetween(db, from, to), [from, to]);
  const currency = settings.currency;
  const custom = settings.customCategories;
  const t = today();

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

  // Rows are numbered across days, so the fade-in runs down the whole list.
  const order = useMemo(() => {
    const m = new Map<string, number>();
    let i = 0;
    for (const s of sections) for (const tx of s.data) m.set(tx.id, i++);
    return m;
  }, [sections]);

  const tot = totals(txs ?? [], from, to);
  const isCurrentMonth = month === startOfMonth(t);
  const searching = query.trim() !== '';
  const filtered = searching || filter !== 'all';
  const monthName = parseISODate(month).toLocaleDateString(undefined, { month: 'long', year: isCurrentMonth ? undefined : 'numeric' });

  return (
    <SectionList
      style={{ flex: 1, backgroundColor: colors.paper }}
      contentContainerStyle={{
        paddingHorizontal: wide ? 28 : margin,
        paddingTop: insets.top + (wide ? 40 : 12),
        paddingBottom: 48,
        width: '100%',
        maxWidth: wide ? undefined : READABLE_MAX + 2 * WIDE_MARGIN,
        alignSelf: 'center',
      }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      sections={sections}
      keyExtractor={(tx) => tx.id}
      stickySectionHeadersEnabled={false}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <View style={{ marginBottom: 0 }}>
          <View style={styles.titleRow}>
            <AppText variant="display" accessibilityRole="header" style={wide && { fontSize: 48, lineHeight: 50, letterSpacing: -1.92 }}>
              History
            </AppText>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <IconButton icon="back" label="Previous month" size={40} iconSize={16} onPress={() => setMonth(addMonths(month, -1, 1))} />
              <AppText weight="medium" accessibilityLiveRegion="polite">
                {monthName}
              </AppText>
              <View style={{ opacity: isCurrentMonth ? 0.3 : 1 }} pointerEvents={isCurrentMonth ? 'none' : 'auto'}>
                <IconButton icon="chevron" label="Next month" size={40} iconSize={16} onPress={() => setMonth(addMonths(month, 1, 1))} />
              </View>
            </View>
          </View>

          <View style={[styles.search, { borderBottomWidth: searching ? 2 : 1 }]}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search shops, notes, amounts"
              placeholderTextColor={colors.grey}
              accessibilityLabel="Search"
              returnKeyType="search"
              style={styles.searchInput}
            />
            {searching ? (
              <IconButton icon="close" label="Clear search" size={32} iconSize={16} onPress={() => setQuery('')} />
            ) : (
              <Icon name="search" size={18} strokeWidth={1.5} />
            )}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -margin, marginTop: 16 }} contentContainerStyle={{ gap: 8, paddingHorizontal: margin }}>
            {FILTERS.map((f) => (
              <Chip key={f.value} label={f.label} selected={filter === f.value} onPress={() => setFilter(f.value)} />
            ))}
          </ScrollView>

          {(txs?.length ?? 0) > 0 && (
            <View style={styles.summary}>
              <AppText variant="caption" muted>
                Out <AppText variant="monoSmall">{formatFigure(tot.spent, currency)}</AppText>
              </AppText>
              <AppText variant="caption" muted>
                In <AppText variant="monoSmall">{formatFigure(tot.income, currency)}</AppText>
              </AppText>
              <AppText variant="caption" muted>
                {txs?.length} {txs?.length === 1 ? 'entry' : 'entries'}
              </AppText>
            </View>
          )}
        </View>
      }
      renderSectionHeader={({ section }) => {
        const net = section.data.reduce((s, x) => s + (x.type === 'income' ? x.amount_cents : -x.amount_cents), 0);
        return <DayHeader label={dayHeading(section.day, t)} total={net} currency={currency} />;
      }}
      renderItem={({ item, index, section }) => (
        <View style={[index === 0 && { marginTop: 4 }, selected === item.id && styles.picked]}>
          <TxRow
            tx={item}
            custom={custom}
            delay={entrance(order.get(item.id) ?? 99)}
            onPress={() => onOpen(item.id)}
          />
        </View>
      )}
      ListEmptyComponent={
        txs ? (
          <EmptyState
            picture={<EmptyPage />}
            title={searching ? `Nothing matches “${query.trim()}”` : filtered ? 'Nothing here' : 'A blank page'}
            body={
              searching
                ? 'Try another word, or look in another month.'
                : filtered
                  ? 'Nothing of this kind this month.'
                  : 'Add what you spend in the Tracker, or scan a receipt in AI mode.'
            }
            action={searching ? <TextLink label="Clear search" onPress={() => setQuery('')} /> : undefined}
          />
        ) : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  listColumn: { width: 400, borderRightWidth: 1, borderRightColor: colors.rule },
  detail: { padding: 40, paddingTop: 56, flexGrow: 1 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 8 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20, height: 44, borderBottomColor: colors.ink },
  searchInput: {
    flex: 1,
    minWidth: 0,
    height: 42,
    fontSize: 17,
    fontFamily: fonts.regular,
    color: colors.ink,
    padding: 0,
    outlineStyle: 'solid',
    outlineWidth: 0,
  },
  summary: { flexDirection: 'row', gap: 18, marginTop: 16 },
  picked: { backgroundColor: colors.page, marginHorizontal: -8, paddingHorizontal: 8 },
});
