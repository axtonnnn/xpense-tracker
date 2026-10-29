import { useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CategoryChips, CategorySheet } from '@/components/CategorySheet';
import { dayLabel, DateSheet } from '@/components/DateSheet';
import { Icon } from '@/components/icons';
import { Mark } from '@/components/marks';
import { Appear, useEntrance } from '@/components/motion';
import { NeedWantCards } from '@/components/money-ui';
import { useConfirm } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import { AmountField, AppText, Button, Chip, Field, IconButton, Notice, Rule, Screen, SectionHeader, Switch, TextTabs, haptic } from '@/components/ui';
import type { Necessity } from '../../../shared/schemas';
import { useLiveQuery } from '@/db/live';
import {
  addRecurring,
  applyDueRecurring,
  countActiveRecurring,
  deleteRecurring,
  FREE_RECURRING_LIMIT,
  listRecurring,
  removeRecurringAndEntries,
  setRecurringActive,
  type Recurring,
} from '@/db/recurring';
import { useSettings } from '@/db/settings';
import { deleteTransaction, insertTransaction, type TxType } from '@/db/transactions';
import { hourlyRateCents, hoursOfWork } from '@/lib/budget';
import { categoryInfo, defaultNecessity } from '@/lib/categories';
import { categorize } from '@/lib/categorize';
import { formatDay, isValidISODate, today } from '@/lib/dates';
import { currencySymbol, formatFigure, formatMoney, parseAmount } from '@/lib/money';
import { usePro, useRequirePro } from '@/lib/pro';
import { CADENCE_LABEL, type Cadence } from '@/lib/recurring';
import { colors, useWide } from '@/theme/tokens';

type Repeat = 'none' | Cadence;
const REPEATS: { value: Repeat; label: string }[] = [
  { value: 'none', label: 'Once' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
];

export default function Tracker() {
  const db = useSQLiteContext();
  const toast = useToast();
  const settings = useSettings();
  const wide = useWide();
  const params = useLocalSearchParams<{ type?: string }>();
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
  const [sheet, setSheet] = useState<'category' | 'date' | null>(null);

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
    setError(null);
  };

  // "Set your paycheck to repeat" on the dashboard opens this on Income, set to weekly.
  const [seenType, setSeenType] = useState<string | undefined>(undefined);
  if (params.type !== seenType) {
    setSeenType(params.type);
    if (params.type === 'income') {
      setType('income');
      setCategory('salary');
      setRepeat('weekly');
    }
  }

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

  const pickCategory = (id: string, nec?: Necessity) => {
    setCategory(id);
    setPickedByHand(true);
    if (type === 'expense') setNecessity(nec ?? defaultNecessity(id, custom));
  };

  const save = async () => {
    setError(null);
    if (!cents || cents <= 0) {
      haptic('warning');
      return setError('Write an amount greater than zero.');
    }
    if (!isValidISODate(date)) return setError('Pick a valid date.');
    setSaving(true);
    try {
      const label = type === 'income' ? 'income' : categoryInfo(category, custom).label.toLowerCase();
      if (repeat !== 'none') {
        if (!isPro && (await countActiveRecurring(db)) >= FREE_RECURRING_LIMIT) {
          requirePro('unlimited_recurring');
          return;
        }
        const id = await addRecurring(db, {
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
        toast({ message: `${formatMoney(cents, currency)} ${label} saved · ${CADENCE_LABEL[repeat].toLowerCase()}`, undo: () => removeRecurringAndEntries(db, id) });
      } else {
        const id = await insertTransaction(db, {
          type,
          amountCents: cents,
          necessity: type === 'expense' ? necessity : null,
          currency,
          merchant,
          note,
          category,
          occurredOn: date,
        });
        toast({ message: `${formatMoney(cents, currency)} ${label} saved`, undo: () => deleteTransaction(db, id) });
      }
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

  const form = (
    <View>
      <TextTabs
        size="lg"
        options={[
          { value: 'expense', label: 'Expense' },
          { value: 'income', label: 'Income' },
        ]}
        value={type}
        onChange={switchType}
      />

      <AmountField
        symbol={currencySymbol(currency)}
        value={amount}
        onChangeText={(v) => {
          setAmount(v);
          setError(null);
        }}
        accessibilityLabel={type === 'expense' ? 'How much did you spend?' : 'How much came in?'}
        style={{ marginTop: 28 }}
      />
      <AppText variant="caption" muted style={{ marginTop: 8, minHeight: 18 }}>
        {hours !== null
          ? `About ${hours < 10 ? hours.toFixed(1) : Math.round(hours)} hours of your work.`
          : type === 'expense'
            ? 'How much did you spend?'
            : 'How much came in?'}
      </AppText>

      <View style={{ marginTop: 28 }}>
        <Field
          label={type === 'expense' ? 'Where or what?' : 'From'}
          value={merchant}
          onChangeText={onMerchant}
          placeholder={type === 'expense' ? 'e.g. groceries, rent, bus pass' : 'e.g. paycheck, allowance'}
          returnKeyType="done"
          hint={guessedFrom && !pickedByHand ? `Guessed from “${guessedFrom}”. Tap below to change.` : undefined}
        />
      </View>

      <AppText variant="caption" muted style={{ marginTop: 28 }}>
        Category
      </AppText>
      <View style={{ marginTop: 8 }}>
        <CategoryChips type={type} value={category} onChange={pickCategory} onMore={() => setSheet('category')} custom={custom} />
      </View>

      {type === 'expense' && (
        <View style={{ marginTop: 28 }}>
          <NeedWantCards value={necessity} onChange={setNecessity} />
        </View>
      )}

      <Pressable
        onPress={() => setSheet('date')}
        accessibilityRole="button"
        accessibilityLabel={`Date: ${dayLabel(date)}. Change`}
        style={({ pressed }) => [styles.dateRow, { opacity: pressed ? 0.5 : 1 }]}>
        <AppText muted>Date</AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 }}>
          <AppText numberOfLines={1}>{dayLabel(date)}</AppText>
          <Icon name="chevron" size={16} strokeWidth={1.5} />
        </View>
      </Pressable>

      <View style={styles.repeatsHead}>
        <AppText variant="caption" muted>
          Repeats
        </AppText>
        {!isPro && (
          <AppText variant="caption" muted>
            Free: up to {FREE_RECURRING_LIMIT}
          </AppText>
        )}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        {REPEATS.map((r) => (
          <Chip key={r.value} label={r.label} selected={repeat === r.value} onPress={() => setRepeat(r.value)} />
        ))}
      </View>

      <View style={{ marginTop: 28 }}>
        <Field label="Note" value={note} onChangeText={setNote} placeholder="Optional" />
      </View>

      {error && (
        <Appear distance={4}>
          <Notice tone="alert" style={{ marginTop: 24 }}>
            {error}
          </Notice>
        </Appear>
      )}

      <Button title={type === 'expense' ? 'Save expense' : 'Save income'} onPress={save} loading={saving} style={{ marginTop: 32 }} />
    </View>
  );

  const repeats = <Repeats recurring={recurring} currency={currency} />;

  return (
    <Screen full={wide}>
      {wide ? (
        <View style={styles.columns}>
          <View style={{ flex: 1 }}>{form}</View>
          <View style={{ flex: 1 }}>{repeats}</View>
        </View>
      ) : (
        <>
          {form}
          <Rule />
          {repeats}
        </>
      )}
      <CategorySheet open={sheet === 'category'} onClose={() => setSheet(null)} type={type} value={category} onChange={pickCategory} custom={custom} />
      <DateSheet open={sheet === 'date'} onClose={() => setSheet(null)} value={date} onChange={setDate} />
    </Screen>
  );
}

/** What repeats: paychecks, rent, subscriptions. Pause with the switch, stop with the cross. */
function Repeats({ recurring, currency }: { recurring?: Recurring[]; currency: string }) {
  const db = useSQLiteContext();
  const { isPro } = usePro();
  const requirePro = useRequirePro();
  const entrance = useEntrance();
  const [dialog, ask] = useConfirm();
  return (
    <View>
      <SectionHeader index="01" title="Repeats" />
      <AppText variant="caption" muted style={{ marginTop: 4 }}>
        Added for you when they’re due.
      </AppText>
      {recurring && recurring.length > 0 ? (
        <View style={{ marginTop: 12 }}>
          {recurring.map((r, i) => (
            <Appear key={r.id} delay={entrance(i) ?? 0} skip={entrance(i) === undefined}>
              <View style={[styles.repeat, { opacity: r.active ? 1 : 0.5 }]}>
                <View style={{ width: 18 }}>
                  <Mark kind={r.type === 'income' ? 'income' : r.necessity === 'want' ? 'want' : 'need'} size={8} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <AppText numberOfLines={1} style={{ lineHeight: 20 }}>
                    {r.label}
                  </AppText>
                  <AppText variant="small" muted numberOfLines={1}>
                    {CADENCE_LABEL[r.cadence]} · {r.active ? `next ${formatDay(r.next_on, { weekday: 'short', day: 'numeric', month: 'short' })}` : 'paused'}
                  </AppText>
                </View>
                <AppText variant="mono">{formatFigure(r.type === 'income' ? r.amount_cents : -r.amount_cents, currency, { sign: true })}</AppText>
                <Switch
                  value={!!r.active}
                  onValueChange={async (on) => {
                    if (on && !isPro && (await countActiveRecurring(db)) >= FREE_RECURRING_LIMIT) {
                      requirePro('unlimited_recurring');
                      return;
                    }
                    await setRecurringActive(db, r.id, on);
                  }}
                  label={`${r.label} repeats`}
                />
                <IconButton
                  icon="close"
                  label={`Stop ${r.label}`}
                  size={28}
                  iconSize={14}
                  color={colors.grey}
                  onPress={async () => {
                    if (await ask(`Stop “${r.label}”?`, 'It won’t be added any more. Entries already saved stay in your history.', 'Stop repeating')) {
                      await deleteRecurring(db, r.id);
                    }
                  }}
                />
              </View>
            </Appear>
          ))}
        </View>
      ) : (
        <AppText muted style={{ marginTop: 16 }}>
          Set your paycheck, rent and subscriptions to repeat, and Xpense adds them for you when they’re due.
        </AppText>
      )}
      {dialog}
    </View>
  );
}

const styles = StyleSheet.create({
  columns: { flexDirection: 'row', gap: 48, alignItems: 'flex-start' },
  dateRow: {
    marginTop: 28,
    height: 56,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.rule,
  },
  repeatsHead: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 28 },
  repeat: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
});
