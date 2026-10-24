import Ionicons from '@expo/vector-icons/Ionicons';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { CategoryPicker } from '@/components/CategoryPicker';
import { DatePicker } from '@/components/DatePicker';
import { CategoryIcon } from '@/components/money-ui';
import { useToast } from '@/components/Toast';
import { AppText, Banner, Button, Card, Divider, Field, Pill, Row, Screen, Segmented, SectionTitle, Toggle } from '@/components/ui';
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
import { fonts, radius, space, useColors } from '@/theme/tokens';

type Repeat = 'none' | Cadence;
const REPEATS: { value: Repeat; label: string }[] = [
  { value: 'none', label: 'Once' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: '2 weeks' },
  { value: 'monthly', label: 'Monthly' },
];

// Manrope ExtraBold advance widths (em), so the amount field hugs its digits on every platform.
// (A web <input> otherwise keeps a ~20-character intrinsic width and pushes the symbol off screen.)
const ADVANCE: Record<string, number> = {
  '0': 0.674, '1': 0.454, '2': 0.604, '3': 0.591, '4': 0.615, '5': 0.589, '6': 0.622, '7': 0.544, '8': 0.623, '9': 0.622, '.': 0.32, ',': 0.316,
};
const AMOUNT_SIZE = 48;
const AMOUNT_TRACKING = -1;

function amountWidth(text: string): number {
  let em = 0;
  for (const ch of text) em += ADVANCE[ch] ?? 0.62;
  return Math.min(260, Math.ceil(em * AMOUNT_SIZE + AMOUNT_TRACKING * text.length) + 12);
}

export default function Tracker() {
  const db = useSQLiteContext();
  const c = useColors();
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
  const [autoSorted, setAutoSorted] = useState(false);
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
    setAutoSorted(false);
  };

  const onMerchant = (text: string) => {
    setMerchant(text);
    if (type !== 'expense' || pickedByHand) return;
    const guess = categorize(text);
    setAutoSorted(!!guess);
    if (guess) {
      setCategory(guess.category);
      setNecessity(guess.necessity);
    }
  };

  const save = async () => {
    setError(null);
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
      setAutoSorted(false);
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

      <Card style={{ alignItems: 'center', paddingVertical: space.xl, gap: space.sm }}>
        <AppText variant="caption" weight="semibold" muted>
          {type === 'expense' ? 'How much did you spend?' : 'How much came in?'}
        </AppText>
        <Row style={{ gap: 4, alignItems: 'center' }}>
          <AppText style={{ fontFamily: fonts.extrabold, fontSize: 30, color: c.inkMuted }}>{currencySymbol(currency)}</AppText>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            placeholderTextColor={c.border}
            keyboardType="decimal-pad"
            accessibilityLabel="Amount"
            style={[styles.amount, { color: c.ink, width: amountWidth(amount || '0.00') }]}
          />
        </Row>
        {hours !== null ? (
          <Pill icon="time-outline" label={`≈ ${hours < 10 ? hours.toFixed(1) : Math.round(hours)} hours of your work`} color={c.wantInk} bg={c.wantSoft} />
        ) : (
          <AppText variant="caption" muted>
            {currency}
          </AppText>
        )}
      </Card>

      <Field
        label={type === 'expense' ? 'Where or what?' : 'From'}
        icon={type === 'expense' ? 'storefront-outline' : 'briefcase-outline'}
        value={merchant}
        onChangeText={onMerchant}
        placeholder={type === 'expense' ? 'e.g. Trader Joe’s, rent, Netflix' : 'e.g. Paycheck'}
        returnKeyType="done"
      />
      {autoSorted && !pickedByHand && (
        <Row style={{ marginTop: -space.sm }}>
          <Ionicons name="sparkles" size={14} color={c.primary} />
          <AppText variant="caption" weight="semibold" color={c.primary}>
            Sorted as {categoryInfo(category, custom).label} · {necessity === 'need' ? 'Need' : 'Want'}
          </AppText>
        </Row>
      )}

      <View style={{ gap: space.sm }}>
        <AppText variant="label" muted>
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
          <AppText variant="label" muted>
            Need or want?
          </AppText>
          <NeedWantCards value={necessity} onChange={setNecessity} />
        </View>
      )}

      <View style={{ gap: space.sm }}>
        <AppText variant="label" muted>
          Date
        </AppText>
        <DatePicker value={date} onChange={setDate} />
      </View>

      <View style={{ gap: space.sm }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <AppText variant="label" muted>
            Repeat
          </AppText>
          {!isPro && (
            <AppText variant="caption" muted>
              Free: up to {FREE_RECURRING_LIMIT} repeating items
            </AppText>
          )}
        </Row>
        <Segmented options={REPEATS} value={repeat} onChange={setRepeat} />
      </View>

      <Field label="Note (optional)" icon="create-outline" value={note} onChangeText={setNote} placeholder="Anything to remember" />

      {error && <Banner tone="danger">{error}</Banner>}

      <Button title={type === 'expense' ? 'Save expense' : 'Save income'} icon="checkmark" onPress={save} loading={saving} />

      <SectionTitle>Repeating</SectionTitle>
      {recurring && recurring.length > 0 ? (
        <Card style={{ gap: 0, paddingVertical: space.sm }}>
          {recurring.map((r, i) => (
            <View key={r.id}>
              {i > 0 && <Divider />}
              <Row style={{ paddingVertical: space.md, gap: space.md, opacity: r.active ? 1 : 0.55 }}>
                <CategoryIcon category={r.category} custom={custom} type={r.type} necessity={r.necessity ?? undefined} size={38} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Row style={{ justifyContent: 'space-between', gap: space.sm }}>
                    <AppText weight="semibold" numberOfLines={1} style={{ flexShrink: 1 }}>
                      {r.label}
                    </AppText>
                    <AppText weight="bold" color={r.type === 'income' ? c.positive : c.ink}>
                      {r.type === 'income' ? '+' : '−'}
                      {formatMoney(r.amount_cents, currency)}
                    </AppText>
                  </Row>
                  <AppText variant="caption" muted numberOfLines={1}>
                    {CADENCE_LABEL[r.cadence]} · {r.active ? `next ${formatDay(r.next_on, { month: 'short', day: 'numeric' })}` : 'paused'}
                  </AppText>
                </View>
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
                  accessibilityLabel={`Delete ${r.label}`}
                  hitSlop={8}>
                  <Ionicons name="trash-outline" size={20} color={c.inkMuted} />
                </Pressable>
              </Row>
            </View>
          ))}
        </Card>
      ) : (
        <Card>
          <Row style={{ gap: space.md, alignItems: 'flex-start' }}>
            <Ionicons name="repeat" size={22} color={c.primary} />
            <AppText muted style={{ flex: 1 }}>
              Set salary, rent and subscriptions to repeat, and Xpense adds them for you when they’re due.
            </AppText>
          </Row>
        </Card>
      )}
    </Screen>
  );
}

function NeedWantCards({ value, onChange }: { value: Necessity; onChange: (v: Necessity) => void }) {
  const c = useColors();
  const options = [
    { key: 'need' as const, icon: 'shield-checkmark' as const, title: 'Need', body: 'Housing, food, bills, getting to work', fg: c.needInk, bg: c.needSoft },
    { key: 'want' as const, icon: 'star' as const, title: 'Want', body: 'Nice extras — the first thing to trim', fg: c.wantInk, bg: c.wantSoft },
  ];
  return (
    <Row style={{ gap: space.md, alignItems: 'stretch' }}>
      {options.map((o) => {
        const active = value === o.key;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            style={[
              styles.nwCard,
              { backgroundColor: active ? o.bg : c.surface, borderColor: active ? o.fg : c.border },
            ]}>
            <Row style={{ gap: 6 }}>
              <Ionicons name={active ? o.icon : (`${o.icon}-outline` as typeof o.icon)} size={18} color={active ? o.fg : c.inkMuted} />
              <AppText weight="bold" color={active ? o.fg : c.ink}>
                {o.title}
              </AppText>
            </Row>
            <AppText variant="caption" muted>
              {o.body}
            </AppText>
          </Pressable>
        );
      })}
    </Row>
  );
}

const styles = StyleSheet.create({
  amount: { fontFamily: fonts.extrabold, fontSize: AMOUNT_SIZE, letterSpacing: AMOUNT_TRACKING, textAlign: 'center', padding: 0, outlineStyle: 'solid', outlineWidth: 0 },
  nwCard: { flex: 1, borderWidth: 1.5, borderRadius: radius.md, padding: space.md, gap: 4 },
});
