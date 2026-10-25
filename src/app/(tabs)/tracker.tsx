import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { CategoryPicker } from '@/components/CategoryPicker';
import { DatePicker } from '@/components/DatePicker';
import { NeedWantCards } from '@/components/money-ui';
import { IncomeMark, NeedMark, SketchRule, WantMark } from '@/components/sketch';
import { useToast } from '@/components/Toast';
import { AppText, Banner, Button, Chip, Field, Label, Row, Screen, SectionTitle, tabular, TextTabs, Toggle } from '@/components/ui';
import type { Necessity } from '../../../shared/schemas';
import { useLiveQuery } from '@/db/live';
import {
  addRecurring,
  applyDueRecurring,
  countActiveRecurring,
  deleteRecurring,
  FREE_RECURRING_LIMIT,
  listRecurring,
  setRecurringActive,
} from '@/db/recurring';
import { useSettings } from '@/db/settings';
import { insertTransaction, type TxType } from '@/db/transactions';
import { hourlyRateCents, hoursOfWork } from '@/lib/budget';
import { categoryInfo, defaultNecessity } from '@/lib/categories';
import { categorize } from '@/lib/categorize';
import { confirm } from '@/lib/confirm';
import { formatDay, isValidISODate, today } from '@/lib/dates';
import { currencySymbol, formatMoney, parseAmount } from '@/lib/money';
import { usePro, useRequirePro } from '@/lib/pro';
import { CADENCE_LABEL, type Cadence } from '@/lib/recurring';
import { colors, fonts, space } from '@/theme/tokens';

type Repeat = 'none' | Cadence;
const REPEATS: { value: Repeat; label: string }[] = [
  { value: 'none', label: 'Once' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
];

// Instrument Serif advance widths (em), so the amount field hugs its digits on every platform.
// (A web <input> otherwise keeps a ~20-character intrinsic width and pushes the symbol off screen.)
const ADVANCE: Record<string, number> = {
  '0': 0.46, '1': 0.249, '2': 0.404, '3': 0.371, '4': 0.393, '5': 0.382, '6': 0.404, '7': 0.364, '8': 0.433, '9': 0.402, '.': 0.213, ',': 0.217,
};
const AMOUNT_SIZE = 72;

function amountWidth(text: string): number {
  let em = 0;
  for (const ch of text) em += ADVANCE[ch] ?? 0.42;
  return Math.min(260, Math.ceil(em * AMOUNT_SIZE) + 10);
}

export default function Tracker() {
  const db = useSQLiteContext();
  const toast = useToast();
  const settings = useSettings();
  const { isPro } = usePro();
  const requirePro = useRequirePro();
  const { data: recurring } = useLiveQuery(listRecurring, []);

  const [type, setType] = useState<TxType>('expense');
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [category, setCategory] = useState('groceries');
  const [necessity, setNecessity] = useState<Necessity>('need');
  const [pickedByHand, setPickedByHand] = useState(false);
  const [guessedFrom, setGuessedFrom] = useState<string | null>(null);
  const [date, setDate] = useState(today());
  const [note, setNote] = useState('');
  const [repeat, setRepeat] = useState<Repeat>('none');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currency = settings?.currency ?? 'USD';
  const custom = settings?.customCategories ?? [];
  const cents = parseAmount(amount);
  const hours =
    type === 'expense' && cents && settings ? hoursOfWork(cents, hourlyRateCents(settings.monthlyIncomeCents, settings.hoursPerWeek)) : null;

  const switchType = (t: TxType) => {
    setType(t);
    setCategory(t === 'income' ? 'salary' : 'groceries');
    setNecessity('need');
    setPickedByHand(false);
    setGuessedFrom(null);
  };

  const onMerchant = (text: string) => {
    setMerchant(text);
    if (type !== 'expense' || pickedByHand) return;
    const guess = categorize(text);
    setGuessedFrom(guess ? guess.matched : null);
    if (guess) {
      setCategory(guess.category);
      setNecessity(guess.necessity);
    }
  };

  const save = async () => {
    setError(null);
    if (!cents || cents <= 0) return setError('Write an amount greater than zero.');
    if (!isValidISODate(date)) return setError('Pick a valid date.');
    setSaving(true);
    try {
      if (repeat !== 'none') {
        if (!isPro && (await countActiveRecurring(db)) >= FREE_RECURRING_LIMIT) {
          requirePro('unlimited_recurring');
          return;
        }
        await addRecurring(db, {
          type,
          label: merchant.trim() || categoryInfo(category, custom).label,
          amountCents: cents,
          category,
          necessity: type === 'expense' ? necessity : null,
          note,
          cadence: repeat,
          startOn: date,
        });
        await applyDueRecurring(db, today(), currency);
      } else {
        await insertTransaction(db, {
          type,
          amountCents: cents,
          necessity: type === 'expense' ? necessity : null,
          currency,
          merchant,
          note,
          category,
          occurredOn: date,
        });
      }
      toast({
        message: `${formatMoney(cents, currency)} ${type === 'income' ? 'income' : categoryInfo(category, custom).label.toLowerCase()} saved${
          repeat !== 'none' ? ` · ${CADENCE_LABEL[repeat].toLowerCase()}` : ''
        }`,
      });
      setAmount('');
      setMerchant('');
      setNote('');
      setRepeat('none');
      setPickedByHand(false);
      setGuessedFrom(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen topInset>
      <TextTabs
        size="lg"
        options={[
          { value: 'expense', label: 'Expense' },
          { value: 'income', label: 'Income' },
        ]}
        value={type}
        onChange={switchType}
      />

      <View style={{ paddingTop: 10 }}>
        <Row style={{ alignItems: 'baseline', gap: 4 }}>
          <AppText style={{ fontFamily: fonts.serif, fontSize: 40, lineHeight: 44, color: colors.graphite }}>{currencySymbol(currency)}</AppText>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            placeholderTextColor={colors.sand}
            keyboardType="decimal-pad"
            accessibilityLabel={type === 'expense' ? 'How much did you spend?' : 'How much came in?'}
            style={[styles.amount, tabular, { width: amountWidth(amount || '0.00') }]}
          />
        </Row>
        <SketchRule seed={41} opacity={1} weight={1.4} />
        <SketchRule seed={42} opacity={0.4} weight={0.7} style={{ marginTop: -5 }} />
        <AppText variant="note" muted style={{ marginTop: 6, minHeight: 23 }}>
          {hours !== null ? `about ${hours < 10 ? hours.toFixed(1) : Math.round(hours)} hours of your work` : type === 'expense' ? 'how much did you spend?' : 'how much came in?'}
        </AppText>
      </View>

      <View>
        <Field
          label={type === 'expense' ? 'Where or what?' : 'From'}
          value={merchant}
          onChangeText={onMerchant}
          placeholder={type === 'expense' ? 'e.g. groceries, rent, bus pass' : 'e.g. paycheck, allowance'}
          returnKeyType="done"
        />
        {guessedFrom && !pickedByHand && (
          <AppText variant="note" muted style={{ marginTop: 6, fontSize: 19 }}>
            guessed from “{guessedFrom}”, tap below to change
          </AppText>
        )}
      </View>

      <CategoryPicker
        type={type}
        value={category}
        custom={custom}
        onChange={(id, nec) => {
          setCategory(id);
          setPickedByHand(true);
          if (type === 'expense') setNecessity(nec ?? defaultNecessity(id, custom));
        }}
      />

      {type === 'expense' && <NeedWantCards value={necessity} onChange={setNecessity} />}

      <View style={{ gap: space.sm }}>
        <Label>Date</Label>
        <DatePicker value={date} onChange={setDate} />
      </View>

      <View style={{ gap: space.sm }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Label>Repeats</Label>
          {!isPro && (
            <AppText variant="caption" faint>
              free: up to {FREE_RECURRING_LIMIT}
            </AppText>
          )}
        </Row>
        <Row style={{ flexWrap: 'wrap' }}>
          {REPEATS.map((r) => (
            <Chip key={r.value} label={r.label} selected={repeat === r.value} onPress={() => setRepeat(r.value)} />
          ))}
        </Row>
      </View>

      <Field label="Note" value={note} onChangeText={setNote} placeholder="Optional" />

      {error && <Banner tone="danger">{error}</Banner>}

      <Button title={type === 'expense' ? 'Save expense' : 'Save income'} onPress={save} loading={saving} />

      <View style={{ marginTop: space.sm }}>
        <SectionTitle note="added for you when due">Repeats</SectionTitle>
        {recurring && recurring.length > 0 ? (
          recurring.map((r, i) => (
            <View key={r.id} style={[styles.repeat, { opacity: r.active ? 1 : 0.5 }]}>
              {r.type === 'income' ? <IncomeMark size={12} /> : r.necessity === 'need' ? <NeedMark size={12} /> : <WantMark size={12} />}
              <View style={{ flex: 1, gap: 2 }}>
                <AppText numberOfLines={1} style={{ fontSize: 15 }}>
                  {r.label}
                </AppText>
                <AppText variant="caption" faint numberOfLines={1}>
                  {CADENCE_LABEL[r.cadence]} · {r.active ? `next ${formatDay(r.next_on, { weekday: 'short', day: 'numeric', month: 'short' })}` : 'paused'}
                </AppText>
              </View>
              <AppText weight="semibold" style={[tabular, { fontSize: 15 }]}>
                {r.type === 'income' ? '+' : ''}
                {formatMoney(r.amount_cents, currency)}
              </AppText>
              <Toggle
                value={!!r.active}
                onValueChange={async (on) => {
                  if (on && !isPro && (await countActiveRecurring(db)) >= FREE_RECURRING_LIMIT) {
                    requirePro('unlimited_recurring');
                    return;
                  }
                  await setRecurringActive(db, r.id, on);
                }}
                label={`${r.label} active`}
              />
              <Pressable
                onPress={async () => {
                  if (await confirm(`Stop “${r.label}”?`, 'It will no longer be added. Entries already saved stay in your history.', 'Delete')) {
                    await deleteRecurring(db, r.id);
                  }
                }}
                accessibilityRole="button"
                accessibilityLabel={`Delete ${r.label}`}
                hitSlop={8}>
                <AppText faint style={{ fontSize: 20 }}>
                  ×
                </AppText>
              </Pressable>
              {i < recurring.length - 1 && <SketchRule seed={50 + i} opacity={0.2} style={styles.repeatRule} />}
            </View>
          ))
        ) : (
          <AppText muted style={{ marginTop: space.sm }}>
            Set your paycheck, rent and subscriptions to repeat, and Xpense adds them for you when they’re due.
          </AppText>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  amount: {
    fontFamily: fonts.serif,
    fontSize: AMOUNT_SIZE,
    lineHeight: 82,
    color: colors.ink,
    padding: 0,
    outlineStyle: 'solid',
    outlineWidth: 0,
  },
  repeat: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  repeatRule: { position: 'absolute', left: 0, right: 0, bottom: -3 },
});
