import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Platform, Pressable, Switch, TextInput, View } from 'react-native';

import { CategoryPicker } from '@/components/CategoryPicker';
import { DatePicker } from '@/components/DatePicker';
import { NeedWantToggle } from '@/components/money-ui';
import { AppText, Banner, Button, Card, Chip, Field, Row, Screen, Segmented, SectionTitle } from '@/components/ui';
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
import { categoryInfo, defaultNecessity } from '@/lib/categories';
import { categorize } from '@/lib/categorize';
import { formatDay, isValidISODate, today } from '@/lib/dates';
import { formatMoney, parseAmount } from '@/lib/money';
import { CADENCE_LABEL, type Cadence } from '@/lib/recurring';
import { usePro, useRequirePro } from '@/lib/pro';
import { radius, space, useColors } from '@/theme/tokens';

type Repeat = 'none' | Cadence;
const REPEATS: { value: Repeat; label: string }[] = [
  { value: 'none', label: 'Once' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: '2 weeks' },
  { value: 'monthly', label: 'Monthly' },
];

export default function Tracker() {
  const db = useSQLiteContext();
  const c = useColors();
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
  const [date, setDate] = useState(today());
  const [note, setNote] = useState('');
  const [repeat, setRepeat] = useState<Repeat>('none');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const currency = settings?.currency ?? 'USD';
  const custom = settings?.customCategories ?? [];

  const switchType = (t: TxType) => {
    setType(t);
    setCategory(t === 'income' ? 'salary' : 'groceries');
    setNecessity('need');
    setPickedByHand(false);
  };

  const onMerchant = (text: string) => {
    setMerchant(text);
    if (type !== 'expense' || pickedByHand) return;
    const guess = categorize(text);
    if (guess) {
      setCategory(guess.category);
      setNecessity(guess.necessity);
    }
  };

  const save = async () => {
    setError(null);
    const cents = parseAmount(amount);
    if (!cents || cents <= 0) return setError('Enter an amount greater than zero.');
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
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSaved(`${type === 'income' ? 'Income' : 'Expense'} of ${formatMoney(cents, currency)} saved${repeat !== 'none' ? ` · repeats ${CADENCE_LABEL[repeat].toLowerCase()}` : ''}.`);
      setAmount('');
      setMerchant('');
      setNote('');
      setRepeat('none');
      setPickedByHand(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Segmented
        options={[
          { value: 'expense', label: 'Expense' },
          { value: 'income', label: 'Income' },
        ]}
        value={type}
        onChange={switchType}
      />

      <Card style={{ alignItems: 'center', paddingVertical: space.xl }}>
        <AppText variant="caption" muted>
          {type === 'expense' ? 'How much did you spend?' : 'How much came in?'}
        </AppText>
        <TextInput
          value={amount}
          onChangeText={(s) => {
            setAmount(s);
            setSaved(null);
          }}
          placeholder="0.00"
          placeholderTextColor={c.inkMuted}
          keyboardType="decimal-pad"
          accessibilityLabel="Amount"
          style={{ fontSize: 46, fontWeight: '700', color: c.ink, textAlign: 'center', minWidth: 160 }}
        />
        <AppText variant="caption" muted>
          {currency}
        </AppText>
      </Card>

      <Field
        label={type === 'expense' ? 'Where or what?' : 'From'}
        value={merchant}
        onChangeText={onMerchant}
        placeholder={type === 'expense' ? 'e.g. Trader Joe’s, rent, Netflix' : 'e.g. Paycheck'}
        returnKeyType="done"
      />

      <View style={{ gap: space.sm }}>
        <AppText variant="caption" muted>
          Category
        </AppText>
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
      </View>

      {type === 'expense' && (
        <View style={{ gap: space.sm }}>
          <AppText variant="caption" muted>
            Is this a need or a want?
          </AppText>
          <NeedWantToggle value={necessity} onChange={setNecessity} />
          <AppText variant="caption" muted>
            {necessity === 'need'
              ? 'Needs keep you safe and healthy: housing, food, bills, getting to work.'
              : 'Wants are nice extras. Fine sometimes; they are the first thing to trim.'}
          </AppText>
        </View>
      )}

      <View style={{ gap: space.sm }}>
        <AppText variant="caption" muted>
          Date
        </AppText>
        <DatePicker value={date} onChange={setDate} />
      </View>

      <View style={{ gap: space.sm }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <AppText variant="caption" muted>
            Repeat
          </AppText>
          {!isPro && (
            <AppText variant="caption" muted>
              Free: up to {FREE_RECURRING_LIMIT} repeating items
            </AppText>
          )}
        </Row>
        <Row style={{ flexWrap: 'wrap' }}>
          {REPEATS.map((r) => (
            <Chip key={r.value} label={r.label} selected={repeat === r.value} onPress={() => setRepeat(r.value)} />
          ))}
        </Row>
      </View>

      <Field label="Note (optional)" value={note} onChangeText={setNote} placeholder="Anything to remember" />

      {error && <Banner tone="danger">{error}</Banner>}
      {saved && <Banner icon="checkmark-circle">{saved}</Banner>}

      <Button title={type === 'expense' ? 'Save expense' : 'Save income'} icon="checkmark" onPress={save} loading={saving} />

      <SectionTitle>Repeating</SectionTitle>
      {recurring && recurring.length > 0 ? (
        <Card style={{ gap: 0, paddingVertical: space.sm }}>
          {recurring.map((r, i) => (
            <Row
              key={r.id}
              style={{
                paddingVertical: space.sm,
                borderTopWidth: i === 0 ? 0 : 1,
                borderColor: c.border,
                opacity: r.active ? 1 : 0.55,
              }}>
              <View style={{ width: 34, height: 34, borderRadius: radius.pill, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={categoryInfo(r.category, custom).icon} size={16} color={r.type === 'income' ? c.income : c.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText numberOfLines={1}>{r.label}</AppText>
                <AppText variant="caption" muted>
                  {r.type === 'income' ? '+' : '−'}
                  {formatMoney(r.amount_cents, currency)} · {CADENCE_LABEL[r.cadence]}
                  {r.active ? ` · next ${formatDay(r.next_on, { month: 'short', day: 'numeric' })}` : ' · paused'}
                </AppText>
              </View>
              <Switch
                value={!!r.active}
                onValueChange={async (on) => {
                  if (on && !isPro && (await countActiveRecurring(db)) >= FREE_RECURRING_LIMIT) {
                    requirePro('unlimited_recurring');
                    return;
                  }
                  await setRecurringActive(db, r.id, on);
                }}
                trackColor={{ true: c.primary, false: c.border }}
                accessibilityLabel={`${r.label} active`}
              />
              <Pressable onPress={() => deleteRecurring(db, r.id)} accessibilityLabel={`Delete ${r.label}`} hitSlop={8}>
                <Ionicons name="trash-outline" size={20} color={c.inkMuted} />
              </Pressable>
            </Row>
          ))}
        </Card>
      ) : (
        <AppText muted>
          Set salary, rent and subscriptions to repeat, and Xpense adds them for you when they’re due.
        </AppText>
      )}
    </Screen>
  );
}
