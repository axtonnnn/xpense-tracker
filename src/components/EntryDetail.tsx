// One entry, to read and change: used as its own screen on phones and beside the list on iPad and Mac.
import { Image } from 'expo-image';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CategorySheet } from './CategorySheet';
import { dayLabel, DateSheet } from './DateSheet';
import { Icon, type IconName } from './icons';
import { Appear } from './motion';
import { HeroAmount, NeedWantCards, NeedWantToggle, SplitBar } from './money-ui';
import { EmptyPage, ReceiptPicture } from './pictures';
import { useConfirm } from './Sheet';
import { useToast } from './Toast';
import { AppText, Button, EmptyState, Field, haptic, Notice, Rule, SectionHeader, TextLink } from './ui';
import type { Necessity } from '../../shared/schemas';
import { useLiveQuery } from '@/db/live';
import { useSettings } from '@/db/settings';
import { deleteTransaction, getTransaction, setItemNecessity, updateTransaction } from '@/db/transactions';
import { categoryInfo, defaultNecessity, type CustomCategory } from '@/lib/categories';
import { formatDay, isValidISODate } from '@/lib/dates';
import { centsToInput, currencySymbol, formatFigure, parseAmount } from '@/lib/money';
import { colors } from '@/theme/tokens';

type Data = NonNullable<Awaited<ReturnType<typeof getTransaction>>>;

/** Loads the entry and shows it, or says it's gone (deleted on another device). */
export function EntryDetail({ id, onDone }: { id: string; onDone: () => void }) {
  const settings = useSettings();
  const { data } = useLiveQuery((d) => getTransaction(d, id), [id]);
  if (data === null) {
    return <EmptyState picture={<EmptyPage />} title="Not found" body="This entry may have been deleted on another device." />;
  }
  if (!data || !settings) return null;
  return <EntryForm key={data.tx.id} data={data} custom={settings.customCategories} onDone={onDone} />;
}

const SOURCE: Record<string, { label: string; icon: IconName }> = {
  scan: { label: 'Scanned with AI', icon: 'scanAdd' },
  recurring: { label: 'Added by a repeat', icon: 'repeats' },
  manual: { label: 'Added by you', icon: 'tracker' },
};

function EntryForm({ data, custom, onDone }: { data: Data; custom: CustomCategory[]; onDone: () => void }) {
  const db = useSQLiteContext();
  const toast = useToast();
  const [dialog, ask] = useConfirm();
  const { tx, receipt, items } = data;
  const [amount, setAmount] = useState(centsToInput(tx.amount_cents));
  const [merchant, setMerchant] = useState(tx.merchant ?? '');
  const [category, setCategory] = useState(tx.category);
  const [necessity, setNecessity] = useState<Necessity>(tx.need_cents >= tx.want_cents ? 'need' : 'want');
  const [date, setDate] = useState(tx.occurred_on);
  const [note, setNote] = useState(tx.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'category' | 'date' | null>(null);

  const isExpense = tx.type === 'expense';
  const hasItems = items.length > 0;
  const info = categoryInfo(tx.category, custom);
  const source = SOURCE[tx.source] ?? SOURCE.manual;
  const symbol = currencySymbol(tx.currency);

  const save = async () => {
    setError(null);
    const cents = parseAmount(amount);
    if (!cents || cents <= 0) {
      haptic('warning');
      return setError('Write an amount greater than zero.');
    }
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
    onDone();
  };

  const remove = async () => {
    if (await ask('Delete this entry?', 'It’s removed from all your devices, along with its receipt.', 'Delete entry')) {
      await deleteTransaction(db, tx.id);
      toast({ message: 'Entry deleted', quiet: true });
      onDone();
    }
  };

  return (
    <View>
      <Appear>
        <AppText variant="caption" muted>
          {formatDay(tx.occurred_on, { weekday: 'long', day: 'numeric', month: 'long' })} · {isExpense ? info.label : 'Income'}
        </AppText>
        <AppText weight="light" style={styles.merchant}>
          {tx.merchant || info.label}
        </AppText>
        <HeroAmount cents={tx.amount_cents} currency={tx.currency} size={72} sign={isExpense ? '−' : '+'} style={{ marginTop: 8 }} />
        <View style={styles.source}>
          <Icon name={source.icon} size={14} strokeWidth={1.5} />
          <AppText variant="caption">{source.label}</AppText>
        </View>
        {isExpense && tx.need_cents > 0 && tx.want_cents > 0 && (
          <View style={{ marginTop: 20 }}>
            <SplitBar need={tx.need_cents} want={tx.want_cents} currency={tx.currency} />
            <AppText variant="caption" muted style={{ marginTop: 10 }}>
              Needs <AppText variant="monoSmall">{formatFigure(tx.need_cents, tx.currency)}</AppText> · Wants{' '}
              <AppText variant="monoSmall">{formatFigure(tx.want_cents, tx.currency)}</AppText>
            </AppText>
          </View>
        )}
      </Appear>

      <Rule style={{ marginTop: 32, marginBottom: 24 }} />

      <Field label="Amount" prefix={symbol} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" inputMode="decimal" />
      <View style={{ marginTop: 20 }}>
        <Field label={isExpense ? 'Where or what?' : 'From'} value={merchant} onChangeText={setMerchant} />
      </View>
      <Row label="Category" value={categoryInfo(category, custom).label} onPress={() => setSheet('category')} first />
      <Row label="Date" value={dayLabel(date)} onPress={() => setSheet('date')} />
      {isExpense && !hasItems && (
        <View style={{ marginTop: 24 }}>
          <NeedWantCards value={necessity} onChange={setNecessity} />
        </View>
      )}
      <View style={{ marginTop: 20 }}>
        <Field label="Note" value={note} onChangeText={setNote} placeholder="Optional" />
      </View>

      {receipt && (
        <View style={{ marginTop: 36 }}>
          <SectionHeader index="01" title="Receipt" />
          <View style={styles.photo}>
            {receipt.image_uri ? (
              <Image source={{ uri: receipt.image_uri }} style={StyleSheet.absoluteFill} contentFit="contain" accessibilityLabel="Receipt photo" />
            ) : (
              <ReceiptPicture width={104} height={150} rows={6} />
            )}
          </View>
          {!receipt.image_uri && (
            <AppText variant="small" muted style={{ marginTop: 8 }}>
              The photo stays on the device that scanned it.
            </AppText>
          )}
          {hasItems && (
            <View style={styles.items}>
              {items.map((it) => (
                <View key={it.id} style={styles.item}>
                  <AppText style={{ flex: 1 }} numberOfLines={2}>
                    {it.name}
                  </AppText>
                  <AppText variant="mono" style={{ width: 60, textAlign: 'right' }}>
                    {formatFigure(it.total_cents, tx.currency)}
                  </AppText>
                  <NeedWantToggle value={it.necessity} label={`${it.name}: need or want`} onChange={(n) => setItemNecessity(db, tx.id, it.id, n)} />
                </View>
              ))}
            </View>
          )}
          {hasItems && (receipt.tax_cents ?? 0) + (receipt.tip_cents ?? 0) > 0 && (
            <AppText variant="caption" muted style={{ marginTop: 12 }}>
              {(receipt.tip_cents ?? 0) > 0 ? 'Tax and tip' : 'Tax'} (
              <AppText variant="monoSmall" muted>
                {formatFigure((receipt.tax_cents ?? 0) + (receipt.tip_cents ?? 0), tx.currency)}
              </AppText>
              ) {(receipt.tip_cents ?? 0) > 0 ? 'are' : 'is'} shared between needs and wants in proportion.
            </AppText>
          )}
        </View>
      )}

      {error && (
        <Appear distance={4}>
          <Notice tone="alert" style={{ marginTop: 24 }}>
            {error}
          </Notice>
        </Appear>
      )}
      <Button title="Save changes" onPress={save} style={{ marginTop: 36 }} />
      <TextLink label="Delete entry" danger onPress={remove} style={{ alignSelf: 'center', marginTop: 8 }} />

      <CategorySheet
        open={sheet === 'category'}
        onClose={() => setSheet(null)}
        type={tx.type}
        value={category}
        custom={custom}
        onChange={(cat, nec) => {
          setCategory(cat);
          if (isExpense && !hasItems) setNecessity(nec ?? defaultNecessity(cat, custom));
        }}
      />
      <DateSheet open={sheet === 'date'} onClose={() => setSheet(null)} value={date} onChange={setDate} />
      {dialog}
    </View>
  );
}

function Row({ label, value, onPress, first }: { label: string; value: string; onPress: () => void; first?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}. Change`}
      style={({ pressed }) => [styles.row, first && { marginTop: 12 }, { opacity: pressed ? 0.5 : 1 }]}>
      <AppText muted>{label}</AppText>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 }}>
        <AppText numberOfLines={1}>{value}</AppText>
        <Icon name="chevron" size={16} strokeWidth={1.5} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  merchant: { fontSize: 32, lineHeight: 36, letterSpacing: -0.96, marginTop: 8 },
  source: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 28,
    paddingHorizontal: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.rule,
  },
  row: { height: 56, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16, borderBottomWidth: 1, borderBottomColor: colors.line },
  photo: { marginTop: 16, height: 180, backgroundColor: colors.page, borderWidth: 1, borderColor: colors.rule, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  items: { marginTop: 16, borderTopWidth: 1, borderTopColor: colors.ink },
  item: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.line },
});
