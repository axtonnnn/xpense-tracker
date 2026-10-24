import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { View } from 'react-native';

import { CategoryPicker } from '@/components/CategoryPicker';
import { DatePicker } from '@/components/DatePicker';
import { LeafSearch } from '@/components/illustrations';
import { CategoryIcon, NeedWantToggle, SplitBar } from '@/components/money-ui';
import { useToast } from '@/components/Toast';
import { AppText, Banner, Button, Card, Divider, EmptyState, Field, Pill, Row, Screen } from '@/components/ui';
import type { Necessity } from '../../../shared/schemas';
import { useLiveQuery } from '@/db/live';
import { useSettings } from '@/db/settings';
import { deleteTransaction, getTransaction, setItemNecessity, updateTransaction } from '@/db/transactions';
import { categoryInfo, defaultNecessity, type CustomCategory } from '@/lib/categories';
import { confirm } from '@/lib/confirm';
import { formatDay, isValidISODate } from '@/lib/dates';
import { centsToInput, formatMoney, parseAmount } from '@/lib/money';
import { radius, space, useColors } from '@/theme/tokens';

export default function TransactionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const settings = useSettings();
  const { data } = useLiveQuery((d) => getTransaction(d, id), [id]);

  if (data === null) {
    return (
      <Screen>
        <EmptyState illustration={<LeafSearch />} title="Not found" body="This entry may have been deleted." />
      </Screen>
    );
  }
  if (!data || !settings) return <Screen>{null}</Screen>;
  return <TransactionForm key={data.tx.id} data={data} custom={settings.customCategories} />;
}

function TransactionForm({
  data,
  custom,
}: {
  data: NonNullable<Awaited<ReturnType<typeof getTransaction>>>;
  custom: CustomCategory[];
}) {
  const db = useSQLiteContext();
  const c = useColors();
  const toast = useToast();
  const [amount, setAmount] = useState(centsToInput(data.tx.amount_cents));
  const [merchant, setMerchant] = useState(data.tx.merchant ?? '');
  const [category, setCategory] = useState(data.tx.category);
  const [necessity, setNecessity] = useState<Necessity>(data.tx.need_cents >= data.tx.want_cents ? 'need' : 'want');
  const [date, setDate] = useState(data.tx.occurred_on);
  const [note, setNote] = useState(data.tx.note ?? '');
  const [error, setError] = useState<string | null>(null);

  const { tx, receipt, items } = data;
  const isExpense = tx.type === 'expense';
  const hasItems = items.length > 0;
  const info = categoryInfo(tx.category, custom);
  const source = tx.source === 'scan' ? 'Scanned with AI' : tx.source === 'recurring' ? 'Added by a repeat' : 'Added by you';

  const save = async () => {
    setError(null);
    const cents = parseAmount(amount);
    if (!cents || cents <= 0) return setError('Enter an amount greater than zero.');
    if (!isValidISODate(date)) return setError('Pick a valid date.');
    await updateTransaction(db, tx.id, {
      amountCents: cents,
      merchant,
      note,
      category,
      occurredOn: date,
      ...(isExpense && !hasItems ? { necessity } : {}),
    });
    toast({ message: 'Changes saved' });
    router.back();
  };

  const remove = async () => {
    if (await confirm('Delete this entry?', 'This also removes its receipt photo from your phone.')) {
      await deleteTransaction(db, tx.id);
      toast({ message: 'Entry deleted', icon: 'trash' });
      router.back();
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: isExpense ? 'Expense' : 'Income' }} />

      <Card style={{ alignItems: 'center', gap: space.sm, paddingVertical: space.xl }}>
        <CategoryIcon category={tx.category} custom={custom} type={tx.type} necessity={tx.need_cents >= tx.want_cents ? 'need' : 'want'} size={56} />
        <AppText variant="display" color={isExpense ? c.ink : c.positive}>
          {isExpense ? '−' : '+'}
          {formatMoney(tx.amount_cents, tx.currency)}
        </AppText>
        <AppText weight="semibold">{tx.merchant || info.label}</AppText>
        <Row style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
          <Pill icon="calendar-outline" label={formatDay(tx.occurred_on, { weekday: 'short', month: 'long', day: 'numeric' })} color={c.inkMuted} bg={c.surfaceAlt} />
          <Pill icon={tx.source === 'scan' ? 'scan' : tx.source === 'recurring' ? 'repeat' : 'create-outline'} label={source} color={c.inkMuted} bg={c.surfaceAlt} />
        </Row>
        {isExpense && tx.need_cents > 0 && tx.want_cents > 0 && (
          <View style={{ alignItems: 'center', gap: 6, marginTop: space.xs }}>
            <SplitBar need={tx.need_cents} want={tx.want_cents} width={160} />
            <AppText variant="caption" muted>
              Needs {formatMoney(tx.need_cents, tx.currency)} · Wants {formatMoney(tx.want_cents, tx.currency)}
            </AppText>
          </View>
        )}
      </Card>

      <AppText variant="label" muted>
        Edit
      </AppText>
      <Field label="Amount" icon="cash-outline" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      <Field label={isExpense ? 'Where or what?' : 'From'} icon={isExpense ? 'storefront-outline' : 'briefcase-outline'} value={merchant} onChangeText={setMerchant} />
      <View style={{ gap: space.sm }}>
        <AppText variant="caption" weight="semibold" muted>
          Category
        </AppText>
        <CategoryPicker
          type={tx.type}
          value={category}
          custom={custom}
          onChange={(cat, nec) => {
            setCategory(cat);
            if (isExpense && !hasItems) setNecessity(nec ?? defaultNecessity(cat, custom));
          }}
        />
      </View>
      {isExpense && !hasItems && (
        <View style={{ gap: space.sm }}>
          <AppText variant="caption" weight="semibold" muted>
            Need or want?
          </AppText>
          <NeedWantToggle value={necessity} onChange={setNecessity} />
        </View>
      )}
      <View style={{ gap: space.sm }}>
        <AppText variant="caption" weight="semibold" muted>
          Date
        </AppText>
        <DatePicker value={date} onChange={setDate} />
      </View>
      <Field label="Note" icon="create-outline" value={note} onChangeText={setNote} placeholder="Optional" />

      {receipt && (
        <Card>
          <AppText variant="title">Receipt</AppText>
          {receipt.image_uri && (
            <Image
              source={{ uri: receipt.image_uri }}
              style={{ width: '100%', height: 280, borderRadius: radius.md, backgroundColor: c.surfaceAlt }}
              contentFit="contain"
              accessibilityLabel="Receipt photo"
            />
          )}
          {items.map((it, i) => (
            <View key={it.id} style={{ gap: space.sm }}>
              {i > 0 && <Divider />}
              <Row style={{ justifyContent: 'space-between', paddingTop: i > 0 ? space.sm : 0 }}>
                <AppText weight="semibold" style={{ flex: 1 }} numberOfLines={2}>
                  {it.name}
                </AppText>
                <AppText weight="bold" style={{ fontVariant: ['tabular-nums'] }}>
                  {formatMoney(it.total_cents, tx.currency)}
                </AppText>
              </Row>
              <NeedWantToggle value={it.necessity} onChange={(n) => setItemNecessity(db, tx.id, it.id, n)} />
            </View>
          ))}
          {(receipt.tax_cents ?? 0) + (receipt.tip_cents ?? 0) > 0 && (
            <AppText variant="caption" muted>
              Tax and tip ({formatMoney((receipt.tax_cents ?? 0) + (receipt.tip_cents ?? 0), tx.currency)}) are shared between needs and wants in
              proportion.
            </AppText>
          )}
        </Card>
      )}

      {error && <Banner tone="danger">{error}</Banner>}
      <Button title="Save changes" icon="checkmark" onPress={save} />
      <Button title="Delete entry" kind="danger" icon="trash-outline" onPress={remove} />
    </Screen>
  );
}
