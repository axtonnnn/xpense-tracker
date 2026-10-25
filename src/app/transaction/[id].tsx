import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { View } from 'react-native';

import { CategoryPicker } from '@/components/CategoryPicker';
import { DatePicker } from '@/components/DatePicker';
import { BlankPageSketch } from '@/components/illustrations';
import { EntryMark, NeedWantCards, NeedWantToggle } from '@/components/money-ui';
import { SketchRule, SplitBar } from '@/components/sketch';
import { useToast } from '@/components/Toast';
import { AppText, Banner, Button, Card, EmptyState, Field, Label, Pill, Row, Screen, tabular } from '@/components/ui';
import type { Necessity } from '../../../shared/schemas';
import { useLiveQuery } from '@/db/live';
import { useSettings } from '@/db/settings';
import { deleteTransaction, getTransaction, setItemNecessity, updateTransaction } from '@/db/transactions';
import { categoryInfo, defaultNecessity, type CustomCategory } from '@/lib/categories';
import { confirm } from '@/lib/confirm';
import { formatDay, isValidISODate } from '@/lib/dates';
import { centsToInput, formatMoney, parseAmount } from '@/lib/money';
import { colors, space } from '@/theme/tokens';

export default function TransactionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const settings = useSettings();
  const { data } = useLiveQuery((d) => getTransaction(d, id), [id]);

  if (data === null) {
    return (
      <Screen>
        <EmptyState illustration={<BlankPageSketch width={170} />} title="Not found" body="This entry may have been deleted on another device." />
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
    if (!cents || cents <= 0) return setError('Write an amount greater than zero.');
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
    if (await confirm('Delete this entry?', 'It’s removed from all your devices, along with its receipt.')) {
      await deleteTransaction(db, tx.id);
      toast({ message: 'Entry deleted', icon: 'trash-outline' });
      router.back();
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: isExpense ? 'Expense' : 'Income' }} />

      <View style={{ gap: 6 }}>
        <Row style={{ gap: 10 }}>
          <EntryMark tx={tx} />
          <AppText variant="caption" muted>
            {formatDay(tx.occurred_on, { weekday: 'long', month: 'long', day: 'numeric' })} · {info.label}
          </AppText>
        </Row>
        <AppText variant="title" style={{ fontSize: 34, lineHeight: 38 }}>
          {tx.merchant || info.label}
        </AppText>
        <AppText variant="hero" style={tabular}>
          {isExpense ? '−' : '+'}
          {formatMoney(tx.amount_cents, tx.currency)}
        </AppText>
        <Pill label={source} />
        {isExpense && tx.need_cents > 0 && tx.want_cents > 0 && (
          <View style={{ gap: 6, marginTop: space.sm }}>
            <SplitBar need={tx.need_cents} want={tx.want_cents} height={12} />
            <AppText variant="caption" muted>
              Needs {formatMoney(tx.need_cents, tx.currency)} · Wants {formatMoney(tx.want_cents, tx.currency)}
            </AppText>
          </View>
        )}
      </View>

      <SketchRule seed={71} opacity={0.3} />

      <Field label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      <Field label={isExpense ? 'Where or what?' : 'From'} value={merchant} onChangeText={setMerchant} />
      <CategoryPicker
        type={tx.type}
        value={category}
        custom={custom}
        onChange={(cat, nec) => {
          setCategory(cat);
          if (isExpense && !hasItems) setNecessity(nec ?? defaultNecessity(cat, custom));
        }}
      />
      {isExpense && !hasItems && <NeedWantCards value={necessity} onChange={setNecessity} />}
      <View style={{ gap: space.sm }}>
        <Label>Date</Label>
        <DatePicker value={date} onChange={setDate} />
      </View>
      <Field label="Note" value={note} onChangeText={setNote} placeholder="Optional" />

      {receipt && (
        <Card seed={`receipt-${receipt.id}`}>
          <AppText variant="title">Receipt</AppText>
          {receipt.image_uri ? (
            <Image
              source={{ uri: receipt.image_uri }}
              style={{ width: '100%', height: 280, backgroundColor: colors.paper }}
              contentFit="contain"
              accessibilityLabel="Receipt photo"
            />
          ) : (
            <AppText variant="note" muted>
              the photo stays on the device that scanned it
            </AppText>
          )}
          {items.map((it, i) => (
            <View key={it.id} style={{ gap: 8 }}>
              {i > 0 && <SketchRule seed={80 + i} opacity={0.18} />}
              <Row style={{ justifyContent: 'space-between', gap: space.md }}>
                <AppText style={{ flex: 1, fontSize: 15 }} numberOfLines={2}>
                  {it.name}
                </AppText>
                <AppText weight="semibold" style={[tabular, { fontSize: 15 }]}>
                  {formatMoney(it.total_cents, tx.currency)}
                </AppText>
                <NeedWantToggle value={it.necessity} onChange={(n) => setItemNecessity(db, tx.id, it.id, n)} />
              </Row>
            </View>
          ))}
          {(receipt.tax_cents ?? 0) + (receipt.tip_cents ?? 0) > 0 && (
            <AppText variant="caption" faint>
              Tax and tip ({formatMoney((receipt.tax_cents ?? 0) + (receipt.tip_cents ?? 0), tx.currency)}) are shared between needs and wants in proportion.
            </AppText>
          )}
        </Card>
      )}

      {error && <Banner tone="danger">{error}</Banner>}
      <Button title="Save changes" onPress={save} />
      <Button title="Delete entry" kind="danger" onPress={remove} />
    </Screen>
  );
}
