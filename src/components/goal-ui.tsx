// The savings goal on the dashboard, the add / take-out sheet, and the new-month check-in.
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { dayLabel, DateSheet } from './DateSheet';
import { Icon } from './icons';
import { CountUp, GoalBar, Panel } from './money-ui';
import { Sheet } from './Sheet';
import { useToast } from './Toast';
import { AmountField, AppText, Button, Chip, Field, haptic, SectionHeader, TextLink } from './ui';
import { addDeposit, deleteDeposit, type Goal, type GoalState } from '@/db/goals';
import { setSettings } from '@/db/settings';
import { endOfMonth, parseISODate, startOfMonth, today } from '@/lib/dates';
import { arrivalMonth, extraFor, movesBetween, monthName, type Checkin } from '@/lib/goal';
import { currencySymbol, formatMoney, parseAmount } from '@/lib/money';
import { colors, useWide } from '@/theme/tokens';

/** "A laptop" → { saving: "a laptop", fund: "laptop fund" }; "iPhone 17" keeps its capitals. */
export function goalWords(name: string): { saving: string; fund: string } {
  const clean = name.trim();
  const first = clean.split(/\s+/)[0] ?? '';
  const lower = /^[A-Z][a-z]*$/.test(first) ? clean.charAt(0).toLowerCase() + clean.slice(1) : clean;
  const bare = lower.replace(/^(a|an|the|my)\s+/i, '');
  return { saving: lower, fund: bare.split(/\s+/).length <= 2 ? `${bare} fund` : 'savings' };
}

function monthOf(iso: string): string {
  return parseISODate(iso).toLocaleDateString(undefined, { month: 'long' });
}

/** The goal is its own screen on phones and a sidebar page on iPad and Mac. */
export function openGoal(wide: boolean): void {
  if (wide) router.navigate('/savings');
  else router.push('/goal');
}

/** "At $300 a month you’ll get there around February." */
export function projection(state: GoalState, setAside: number, currency: string, t = today()): string {
  const { goal, saved, deposits } = state;
  if (saved >= goal.target_cents) return 'You’ve saved enough. Well done.';
  if (setAside <= 0) return 'Set an amount to put aside each month in Settings to see when you’ll get there.';
  const thisMonth = movesBetween(deposits, startOfMonth(t), endOfMonth(t)).deposits;
  const arrival = arrivalMonth({ today: t, target: goal.target_cents, saved, setAside, depositedThisMonth: thisMonth });
  if (!arrival) return `At ${formatMoney(setAside, currency, { compact: true })} a month it will take a while. Adding a little extra helps.`;
  return `At ${formatMoney(setAside, currency, { compact: true })} a month you’ll get there around ${monthName(arrival, t)}.`;
}

/** The dashboard's goal module: what's saved, the bar, and when you'll get there. */
export function GoalSummary({
  index,
  state,
  setAside,
  currency,
  onAdd,
}: {
  index: string;
  state: GoalState;
  setAside: number;
  currency: string;
  onAdd: () => void;
}) {
  const wide = useWide();
  const { goal, saved } = state;
  const pct = Math.round(Math.min(1, saved / Math.max(1, goal.target_cents)) * 100);
  return (
    <View>
      <SectionHeader index={index} title={`Saving for ${goalWords(goal.name).saving}`} action={{ label: 'Add money', onPress: onAdd }} />
      <Pressable
        onPress={() => openGoal(wide)}
        accessibilityRole="button"
        accessibilityLabel={`${formatMoney(saved, currency)} saved of ${formatMoney(goal.target_cents, currency)}, ${pct}%. Open the goal`}
        style={({ pressed }) => ({ marginTop: 16, opacity: pressed ? 0.6 : 1 })}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <CountUp variant="headline" cents={saved} format={(c) => formatMoney(c, currency, { compact: true })} />
          <AppText muted>of {formatMoney(goal.target_cents, currency, { compact: true })}</AppText>
          <AppText variant="monoSmall" style={{ marginLeft: 'auto' }}>
            {pct}%
          </AppText>
        </View>
        <View style={{ marginTop: 14 }}>
          <GoalBar saved={saved} target={goal.target_cents} currency={currency} />
        </View>
        <AppText variant="caption" muted style={{ marginTop: 14 }}>
          {projection(state, setAside, currency)}
        </AppText>
      </Pressable>
    </View>
  );
}

/** When there's no goal yet: a quiet invitation. */
export function GoalInvite({ index }: { index: string }) {
  return (
    <View>
      <SectionHeader index={index} title="Saving up for something?" action={{ label: 'Start a goal', onPress: () => router.push({ pathname: '/goal/edit', params: { new: '1' } }) }} />
      <AppText variant="caption" muted style={{ marginTop: 8 }}>
        Add what you want and what it costs. Xpense shows how close you are and when you’ll get there.
      </AppText>
    </View>
  );
}

/** At the start of a month: did last month's set-aside go into savings? */
export function CheckinPanel({ checkin, goal, currency, onOther }: { checkin: Checkin; goal: Goal; currency: string; onOther: () => void }) {
  const db = useSQLiteContext();
  const toast = useToast();
  const month = monthOf(checkin.month);
  const amount = formatMoney(checkin.amount, currency, { compact: true });
  const key = checkin.month.slice(0, 7);
  const yes = async () => {
    // Dated in the month it belongs to, so it counts as that month's set-aside.
    await addDeposit(db, { goalId: goal.id, amountCents: checkin.amount, occurredOn: endOfMonth(checkin.month), note: `${month}’s set-aside` });
    await setSettings(db, { goal_checkin: key });
    toast({ message: `${amount} added to your ${goalWords(goal.name).fund}` });
  };
  return (
    <Panel style={{ marginTop: 28 }}>
      <AppText variant="index" muted>
        New month
      </AppText>
      <AppText variant="title" style={{ marginTop: 8 }}>
        {checkin.partial ? `Did the rest of ${month}’s set-aside go into savings?` : `Did ${month}’s ${amount} go into savings?`}
      </AppText>
      <AppText variant="caption" muted style={{ marginTop: 8 }}>
        Add it to your {goalWords(goal.name).fund} so the goal shows what you really have.
      </AppText>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
        <Button compact title={`Yes, add ${amount}`} onPress={yes} style={{ flex: 1, paddingHorizontal: 8 }} />
        <Button compact kind="secondary" title="Other amount" onPress={onOther} style={{ flex: 1, paddingHorizontal: 8 }} />
      </View>
      <TextLink
        label="Not this month"
        onPress={() => setSettings(db, { goal_checkin: key })}
        style={{ alignSelf: 'flex-start', marginTop: 6, minHeight: 40 }}
      />
    </Panel>
  );
}

export type MoneySheetState = { mode: 'add' | 'take'; forMonth?: string; open: boolean; key: number };

/** Open, close and reset the add / take-out sheet. */
export function useMoneySheet() {
  const [sheet, setSheet] = useState<MoneySheetState | null>(null);
  return {
    sheet,
    open: (mode: 'add' | 'take', forMonth?: string) => setSheet({ mode, forMonth, open: true, key: Date.now() }),
    close: () => setSheet((s) => (s ? { ...s, open: false } : s)),
    gone: () => setSheet(null),
  };
}

/**
 * Add money to the goal, or take some out. Deposits within the month's set-aside leave what's safe to
 * spend alone; anything extra comes out of it, and money taken out goes back in.
 */
export function MoneySheet({
  open,
  onClose,
  mode,
  state,
  setAside,
  currency,
  forMonth,
  onGone,
}: {
  open: boolean;
  onClose: () => void;
  mode: 'add' | 'take';
  state: GoalState;
  setAside: number;
  currency: string;
  /** The check-in's "Other amount": a deposit for last month. */
  forMonth?: string;
  /** Called once the sheet has slid away (unmount it then, so it opens fresh next time). */
  onGone?: () => void;
}) {
  const db = useSQLiteContext();
  const toast = useToast();
  const t = today();
  const { goal, saved, deposits } = state;
  const [date, setDate] = useState(forMonth ? endOfMonth(forMonth) : t);
  const monthStart = startOfMonth(date);
  const depositedThatMonth = movesBetween(deposits, monthStart, endOfMonth(date)).deposits;
  const owed = Math.max(0, setAside - depositedThatMonth);
  const [text, setText] = useState(mode === 'add' && owed > 0 ? String(owed / 100) : '');
  const [note, setNote] = useState('');
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cents = parseAmount(text) ?? 0;
  const month = monthOf(date);
  const words = goalWords(goal.name);
  const extra = mode === 'add' ? extraFor(depositedThatMonth, cents, setAside) : 0;

  const hint =
    mode === 'take'
      ? `It goes back into what’s safe to spend in ${month}.`
      : cents <= 0
        ? setAside > 0
          ? `${month}’s set-aside is ${formatMoney(setAside, currency, { compact: true })}. Anything more comes out of what’s safe to spend.`
          : 'Money you add comes out of what’s safe to spend this month.'
        : extra === 0
          ? `This is ${month}’s set-aside, so what’s safe to spend stays the same.`
          : extra === cents
            ? `${formatMoney(extra, currency)} comes out of what’s safe to spend in ${month}.`
            : `${formatMoney(extra, currency)} more than ${month}’s set-aside comes out of what’s safe to spend.`;

  const save = async () => {
    setError(null);
    if (cents <= 0) {
      haptic('warning');
      return setError('Write an amount greater than zero.');
    }
    if (mode === 'take' && cents > saved) {
      haptic('warning');
      return setError(`There’s ${formatMoney(saved, currency)} saved, so you can take out up to that.`);
    }
    setBusy(true);
    try {
      const id = await addDeposit(db, {
        goalId: goal.id,
        amountCents: cents,
        occurredOn: date,
        note: note.trim() || (mode === 'add' && extra === 0 && setAside > 0 ? `${month}’s set-aside` : null),
        kind: mode === 'add' ? 'deposit' : 'withdrawal',
      });
      if (forMonth) await setSettings(db, { goal_checkin: forMonth.slice(0, 7) });
      const reached = mode === 'add' && saved < goal.target_cents && saved + cents >= goal.target_cents;
      if (reached) haptic('success');
      toast({
        message: reached
          ? `You reached your goal: ${formatMoney(goal.target_cents, currency, { compact: true })}`
          : mode === 'add'
            ? `${formatMoney(cents, currency)} added to your ${words.fund}`
            : `${formatMoney(cents, currency)} taken out of your ${words.fund}`,
        undo: () => deleteDeposit(db, id),
        quiet: reached,
      });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const chips = mode === 'add' ? [owed > 0 ? owed : null, 5000, 10000].filter((c): c is number => !!c) : [];

  return (
    <Sheet open={open} onClose={onClose} onGone={onGone} title={mode === 'add' ? `Add to your ${words.fund}` : `Take money out of your ${words.fund}`}>
      <AmountField
        symbol={currencySymbol(currency)}
        size={64}
        value={text}
        onChangeText={(v) => {
          setText(v);
          setError(null);
        }}
        accessibilityLabel="Amount"
        autoFocus={!text}
        style={{ marginTop: 20 }}
      />
      {chips.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
          {chips.map((c, i) => (
            <Chip
              key={`${i}-${c}`}
              small
              label={i === 0 && c === owed ? `${formatMoney(c, currency, { compact: true })} · ${month}’s set-aside` : formatMoney(c, currency, { compact: true })}
              selected={cents === c}
              onPress={() => setText(String(c / 100))}
            />
          ))}
        </View>
      )}
      <View style={{ marginTop: 24 }}>
        <Field label="Note (optional)" value={note} onChangeText={setNote} placeholder={mode === 'add' ? 'e.g. birthday money' : 'e.g. car repair'} maxLength={60} />
      </View>
      <Pressable onPress={() => setPicking(true)} accessibilityRole="button" accessibilityLabel={`Date: ${dayLabel(date)}. Change`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 44, marginTop: 16 }}>
        <Icon name="date" size={18} />
        <AppText>{dayLabel(date)}</AppText>
      </Pressable>
      <AppText variant="caption" color={error ? colors.alert : colors.grey} style={{ marginTop: 8 }} accessibilityLiveRegion="polite">
        {error ?? hint}
      </AppText>
      <Button
        title={cents > 0 ? `${mode === 'add' ? 'Add' : 'Take out'} ${formatMoney(cents, currency)}` : mode === 'add' ? 'Add money' : 'Take money out'}
        onPress={save}
        loading={busy}
        style={{ marginTop: 24 }}
      />
      <TextLink label="Cancel" onPress={onClose} style={{ alignSelf: 'center', marginTop: 8 }} />
      <DateSheet open={picking} onClose={() => setPicking(false)} value={date} onChange={setDate} />
    </Sheet>
  );
}
