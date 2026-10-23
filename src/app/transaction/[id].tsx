import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { View } from 'react-native';

import { CategoryPicker } from '@/components/CategoryPicker';
import { DatePicker } from '@/components/DatePicker';
import { NeedWantToggle, SplitBar } from '@/components/money-ui';
import { AppText, Banner, Button, Card, EmptyState, Field, Row, Screen } from '@/components/ui';
import type { Necessity } from '../../../shared/schemas';
import { useLiveQuery } from '@/db/live';
import { useSettings } from '@/db/settings';
import { deleteTransaction, getTransaction, setItemNecessity, updateTransaction } from '@/db/transactions';
import { defaultNecessity, type CustomCategory } from '@/lib/categories';
import { confirm } from '@/lib/confirm';
import { isValidISODate } from '@/lib/dates';
import { centsToInput, formatMoney, parseAmount } from '@/lib/money';
import { radius, space, useColors } from '@/theme/tokens';

export default function TransactionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const settings = useSettings();
  const { data } = useLiveQuery((d) => getTransaction(d, id), [id]);

  if (data === null) {
    return (
      <Screen>
        <EmptyState icon="alert-circle-outline" title="Not found" body="This entry may have been deleted." />
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
    router.back();
  };

  const remove = async () => {
    if (await confirm('Delete this entry?', 'This also removes its receipt photo from your phone.')) {
      await deleteTransaction(db, tx.id);
      router.back();
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: isExpense ? 'Expense' : 'Income' }} />
      <Field label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      <Field label={isExpense ? 'Where or what?' : 'From'} value={merchant} onChangeText={setMerchant} />
      <View style={{ gap: space.sm }}>
        <AppText variant="caption" muted>
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
          <AppText variant="caption" muted>
            Need or want?
          </AppText>
          <NeedWantToggle value={necessity} onChange={setNecessity} />
        </View>
      )}
      <View style={{ gap: space.sm }}>
        <AppText variant="caption" muted>
          Date
        </AppText>
        <DatePicker value={date} onChange={setDate} />
      </View>
      <Field label="Note" value={note} onChangeText={setNote} placeholder="Optional" />

      {receipt && (
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <AppText variant="title">Receipt</AppText>
            <SplitBar need={tx.need_cents} want={tx.want_cents} width={72} />
          </Row>
          {receipt.image_uri && (
            <Image
              source={{ uri: receipt.image_uri }}
              style={{ width: '100%', height: 260, borderRadius: radius.sm, backgroundColor: c.surfaceAlt }}
              contentFit="contain"
              accessibilityLabel="Receipt photo"
            />
          )}
          <AppText variant="caption" muted>
            Needs {formatMoney(tx.need_cents, tx.currency)} · Wants {formatMoney(tx.want_cents, tx.currency)}
          </AppText>
          {items.map((it) => (
            <View key={it.id} style={{ gap: 6, paddingTop: space.sm, borderTopWidth: 1, borderColor: c.border }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <AppText style={{ flex: 1 }} numberOfLines={2}>
                  {it.name}
                </AppText>
                <AppText style={{ fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                  {formatMoney(it.total_cents, tx.currency)}
                </AppText>
              </Row>
              <NeedWantToggle value={it.necessity} onChange={(n) => setItemNecessity(db, tx.id, it.id, n)} />
            </View>
          ))}
          {(receipt.tax_cents ?? 0) + (receipt.tip_cents ?? 0) > 0 && (
            <AppText variant="caption" muted>
              Tax and tip ({formatMoney((receipt.tax_cents ?? 0) + (receipt.tip_cents ?? 0), tx.currency)}) are shared
              between needs and wants in proportion.
            </AppText>
          )}
        </Card>
      )}

      {error && <Banner tone="danger">{error}</Banner>}
      <Button title="Save changes" icon="checkmark" onPress={save} />
      <Button title="Delete" kind="danger" icon="trash-outline" onPress={remove} />
    </Screen>
  );
}
