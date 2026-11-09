import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { View } from 'react-native';

import { Appear } from '@/components/motion';
import { useConfirm } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import { AppText, Button, Field, haptic, Notice, Screen, TextLink, TopBar } from '@/components/ui';
import { createGoal, deleteGoal, updateGoal, useActiveGoal } from '@/db/goals';
import { setSettings, useSettings } from '@/db/settings';
import { today } from '@/lib/dates';
import { arrivalMonth, monthName } from '@/lib/goal';
import { centsToInput, currencySymbol, formatMoney, parseAmount } from '@/lib/money';
import { colors } from '@/theme/tokens';

/** Start a savings goal, or change the one you have: what it is, what it costs, and the monthly set-aside. */
export default function GoalEdit() {
  const params = useLocalSearchParams<{ new?: string }>();
  const settings = useSettings();
  const state = useActiveGoal();
  if (!settings || state === undefined) return <Screen>{null}</Screen>;
  const fresh = params.new === '1' || !state;
  return <GoalForm key={fresh ? 'new' : state?.goal.id} fresh={fresh} state={fresh ? null : state} setAside={settings.savingsGoalCents} currency={settings.currency} />;
}

function GoalForm({
  fresh,
  state,
  setAside,
  currency,
}: {
  fresh: boolean;
  state: NonNullable<ReturnType<typeof useActiveGoal>> | null;
  setAside: number;
  currency: string;
}) {
  const db = useSQLiteContext();
  const toast = useToast();
  const [dialog, ask] = useConfirm();
  const [name, setName] = useState(state?.goal.name ?? '');
  const [cost, setCost] = useState(state ? centsToInput(state.goal.target_cents) : '');
  const [already, setAlready] = useState('');
  const [monthly, setMonthly] = useState(setAside > 0 ? centsToInput(setAside) : '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const t = today();
  const symbol = currencySymbol(currency);
  const target = parseAmount(cost);
  const start = parseAmount(already) ?? 0;
  const per = parseAmount(monthly) ?? 0;
  const saved = state ? state.saved : start;
  const arrival = target && target > 0 && per > 0 ? arrivalMonth({ today: t, target, saved, setAside: per, depositedThisMonth: 0 }) : null;

  const save = async () => {
    setError(null);
    if (!name.trim()) {
      haptic('warning');
      return setError('Write what you’re saving for.');
    }
    if (!target || target <= 0) {
      haptic('warning');
      return setError('Write what it costs.');
    }
    setSaving(true);
    try {
      if (state) await updateGoal(db, state.goal.id, { name, targetCents: target });
      else await createGoal(db, { name, targetCents: target, startedOn: t, alreadySavedCents: start });
      await setSettings(db, { savings_goal_cents: per, saving_for: name.trim().slice(0, 60) });
      toast({ message: state ? 'Goal saved' : `Saving for ${name.trim().toLowerCase()}` });
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!state) return;
    if (await ask('Delete this goal?', 'It and everything you added to it are removed from all your devices. Your monthly set-aside stays in Settings.', 'Delete goal')) {
      await deleteGoal(db, state.goal.id);
      await setSettings(db, { saving_for: '' });
      toast({ message: 'Goal deleted', quiet: true });
      router.dismissTo('/');
    }
  };

  return (
    <Screen contentStyle={{ maxWidth: 520 }}>
      <TopBar onBack={() => router.back()} close />
      <Appear>
        <AppText variant="headline" accessibilityRole="header" style={{ marginTop: 24 }}>
          {fresh ? 'Saving up for something?' : 'Your goal'}
        </AppText>
        {fresh && (
          <AppText muted style={{ marginTop: 10 }}>
            Xpense keeps track of how close you are, and when you’ll get there.
          </AppText>
        )}
      </Appear>
      <View style={{ marginTop: 28, gap: 24 }}>
        <Field label="What is it?" value={name} onChangeText={setName} placeholder="e.g. a laptop, moving out" maxLength={60} autoFocus={fresh} />
        <Field label="How much does it cost?" prefix={symbol} value={cost} onChangeText={setCost} placeholder="0" keyboardType="decimal-pad" inputMode="decimal" />
        {fresh && (
          <Field
            label="Already saved for it (optional)"
            prefix={symbol}
            value={already}
            onChangeText={setAlready}
            placeholder="0"
            keyboardType="decimal-pad"
            inputMode="decimal"
            hint="Money you had before today. It doesn’t change what’s safe to spend."
          />
        )}
        <Field
          label="Set aside each month"
          prefix={symbol}
          value={monthly}
          onChangeText={setMonthly}
          placeholder="0"
          keyboardType="decimal-pad"
          inputMode="decimal"
          hint="Kept out of what’s safe to spend each month."
        />
      </View>

      {arrival && target ? (
        <Appear distance={6}>
          <View style={{ marginTop: 28, padding: 16, backgroundColor: colors.page, borderWidth: 1, borderColor: colors.rule }}>
            <AppText>
              {saved >= target ? (
                'You’ve already saved enough.'
              ) : (
                <>
                  At {formatMoney(per, currency, { compact: true })} a month, you’ll get there around <AppText weight="medium">{monthName(arrival, t)}</AppText>.
                </>
              )}
            </AppText>
          </View>
        </Appear>
      ) : null}

      {error && (
        <Appear distance={4}>
          <Notice tone="alert" style={{ marginTop: 24 }}>
            {error}
          </Notice>
        </Appear>
      )}

      <View style={{ marginTop: 'auto', paddingTop: 40 }}>
        <Button title={fresh ? 'Start saving' : 'Save changes'} onPress={save} loading={saving} />
        {!fresh && <TextLink label="Delete this goal" danger onPress={remove} style={{ alignSelf: 'center', marginTop: 8 }} />}
      </View>
      {dialog}
    </Screen>
  );
}
