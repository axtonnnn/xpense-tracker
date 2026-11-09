import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { DisclosureList } from '@/components/ConsentSheet';
import { goalWords } from '@/components/goal-ui';
import { Mark } from '@/components/marks';
import { Appear, timing, useMotion } from '@/components/motion';
import { AppText, Button, Chip, Field, haptic, Notice, Screen, Segmented, Switch, TextLink } from '@/components/ui';
import { createGoal } from '@/db/goals';
import { setSettings } from '@/db/settings';
import { useUser } from '@/lib/auth';
import { addMonths, parseISODate, startOfMonth, today } from '@/lib/dates';
import { arrivalMonth, monthName } from '@/lib/goal';
import { CURRENCIES, currencySymbol, formatMoney, parseAmount } from '@/lib/money';
import { colors, motion } from '@/theme/tokens';

function guessCurrency(): string {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? '';
    const region = locale.split('-').pop()?.toUpperCase();
    const map: Record<string, string> = {
      US: 'USD', GB: 'GBP', CA: 'CAD', AU: 'AUD', IN: 'INR', JP: 'JPY', MX: 'MXN', BR: 'BRL', NG: 'NGN', ZA: 'ZAR', PH: 'PHP',
      DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', IE: 'EUR',
    };
    return (region && map[region]) || 'USD';
  } catch {
    return 'USD';
  }
}

type PayEvery = 'week' | 'month';
const WEEKS_PER_MONTH = 52 / 12;
const SHOWN_CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];

export default function Onboarding() {
  const db = useSQLiteContext();
  const user = useUser();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(user.name ?? '');
  const [goalName, setGoalName] = useState('');
  const [goalCost, setGoalCost] = useState('');
  const [currency, setCurrency] = useState(guessCurrency);
  const [moreCurrencies, setMoreCurrencies] = useState(false);
  const [pay, setPay] = useState('');
  const [every, setEvery] = useState<PayEvery>('month');
  const [hours, setHours] = useState('');
  const [setAside, setSetAside] = useState('');
  const [aiConsent, setAiConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const t = today();
  const symbol = currencySymbol(currency);
  const payCents = parseAmount(pay);
  const monthlyCents = payCents === null ? null : every === 'week' ? Math.round(payCents * WEEKS_PER_MONTH) : payCents;
  const hourly = monthlyCents && Number(hours) > 0 ? Math.round((monthlyCents * 12) / 52 / Number(hours)) : null;
  const targetCents = parseAmount(goalCost);
  const hasGoal = !!goalName.trim() && !!targetCents && targetCents > 0;
  const setAsideCents = parseAmount(setAside);
  const arrival = hasGoal && setAsideCents ? arrivalMonth({ today: t, target: targetCents, saved: 0, setAside: setAsideCents, depositedThisMonth: 0 }) : null;

  const finish = async () => {
    setSaving(true);
    try {
      const h = Number(hours);
      await setSettings(db, {
        name: name.trim().slice(0, 40),
        saving_for: hasGoal ? goalName.trim().slice(0, 60) : '',
        currency,
        monthly_income_cents: monthlyCents ?? 0,
        savings_goal_cents: setAsideCents ?? 0,
        hours_per_week: Number.isFinite(h) && h > 0 ? Math.min(h, 100) : 40,
        ai_consent: aiConsent,
        onboarded: true,
      });
      if (hasGoal) await createGoal(db, { name: goalName, targetCents, startedOn: t });
      haptic('success');
      router.replace('/');
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    setError(null);
    if (step === 0 && goalName.trim() && (!targetCents || targetCents <= 0)) {
      haptic('warning');
      return setError('Write what it costs, or leave both empty for now.');
    }
    if (step === 1) {
      if (pay && (payCents === null || payCents < 0)) {
        haptic('warning');
        return setError('Write your pay as a number, or leave it empty for now.');
      }
      if (setAsideCents !== null && monthlyCents !== null && setAsideCents > monthlyCents) {
        haptic('warning');
        return setError('That’s more than you earn in a month.');
      }
    }
    haptic('light');
    setStep((s) => s + 1);
  };

  const back = () => {
    setError(null);
    setStep((s) => Math.max(0, s - 1));
  };

  return (
    <Screen contentStyle={{ maxWidth: 520, paddingBottom: 40 }}>
      <Progress step={step} />

      {step === 0 && (
        <Appear key="s0" distance={12}>
          <AppText variant="headline" accessibilityRole="header" style={{ marginTop: 36 }}>
            What should we call you?
          </AppText>
          <View style={{ marginTop: 28 }}>
            <Field label="Your first name" value={name} onChangeText={setName} placeholder="e.g. Sam" autoComplete="given-name" textContentType="givenName" maxLength={40} />
          </View>
          <View style={styles.section}>
            <AppText variant="title">Saving up for something?</AppText>
            <AppText variant="caption" muted style={{ marginTop: 6 }}>
              Optional. Xpense keeps track of how close you are.
            </AppText>
            <View style={{ marginTop: 20, gap: 20 }}>
              <Field label="What is it?" value={goalName} onChangeText={setGoalName} placeholder="e.g. a laptop, moving out" maxLength={60} />
              <Field label="How much does it cost?" prefix={symbol} value={goalCost} onChangeText={setGoalCost} placeholder="0" keyboardType="decimal-pad" inputMode="decimal" />
            </View>
          </View>
          <View style={{ marginTop: 36, gap: 14 }}>
            <Point kind="need" bold="Needs first." text="See what’s safe to spend after rent, bills and saving." />
            <Point kind="want" bold="Wants, honestly." text="Every receipt sorted, without the guilt." />
            <Point kind="income" bold="Your pay, your pace." text="Weekly shifts or a monthly salary, it all works." />
          </View>
        </Appear>
      )}

      {step === 1 && (
        <Appear key="s1" distance={12}>
          <AppText variant="headline" accessibilityRole="header" style={{ marginTop: 36 }}>
            Your money
          </AppText>
          <AppText muted style={{ marginTop: 10 }}>
            This sets up what’s safe to spend. You can change it any time in Settings.
          </AppText>

          <AppText variant="caption" muted style={{ marginTop: 28 }}>
            Currency
          </AppText>
          <View style={styles.chips}>
            {(moreCurrencies ? CURRENCIES : SHOWN_CURRENCIES.includes(currency) ? SHOWN_CURRENCIES : [...SHOWN_CURRENCIES, currency]).map((c) => (
              <Chip key={c} label={c} selected={c === currency} onPress={() => setCurrency(c)} />
            ))}
            {!moreCurrencies && <Chip label="Other" onPress={() => setMoreCurrencies(true)} />}
          </View>

          <View style={{ marginTop: 28 }}>
            <AppText variant="caption" muted>
              Take-home pay, after tax
            </AppText>
            <View style={styles.payRow}>
              <View style={{ flex: 1 }}>
                <Field prefix={symbol} value={pay} onChangeText={setPay} placeholder="0" keyboardType="decimal-pad" inputMode="decimal" accessibilityLabel="Take-home pay" />
              </View>
              <Segmented
                compact
                height={42}
                label="How often"
                value={every}
                onChange={setEvery}
                options={[
                  { value: 'week', label: 'a week' },
                  { value: 'month', label: 'a month' },
                ]}
                style={{ width: 148 }}
              />
            </View>
            {every === 'week' && monthlyCents ? (
              <AppText variant="caption" muted style={{ marginTop: 8 }}>
                About <AppText variant="caption">{formatMoney(monthlyCents, currency, { compact: true })}</AppText> a month.
              </AppText>
            ) : null}
          </View>

          <View style={{ marginTop: 28 }}>
            <Field label="Hours you work in a week (optional)" value={hours} onChangeText={setHours} placeholder="e.g. 32" keyboardType="number-pad" inputMode="numeric" />
            <AppText variant="caption" muted style={{ marginTop: 8 }}>
              {hourly ? (
                <>
                  Prices can then show as hours of your work: about <AppText variant="caption">{formatMoney(hourly, currency)}</AppText> an hour.
                </>
              ) : (
                'Prices can then show as hours of your work.'
              )}
            </AppText>
          </View>

          <View style={{ marginTop: 28 }}>
            <Field
              label={hasGoal ? `Set aside each month for ${goalWords(goalName).saving}` : 'Set aside each month'}
              prefix={symbol}
              value={setAside}
              onChangeText={setSetAside}
              placeholder="0"
              keyboardType="decimal-pad"
              inputMode="decimal"
            />
            {monthlyCents ? (
              <View style={[styles.chips, { marginTop: 12 }]}>
                {[10, 20, 30].map((pct) => {
                  const cents = Math.round((monthlyCents * pct) / 100 / 100) * 100;
                  return (
                    <Chip
                      key={pct}
                      small
                      label={`${pct}% · ${formatMoney(cents, currency, { compact: true })}`}
                      selected={setAsideCents === cents}
                      onPress={() => setSetAside(String(cents / 100))}
                    />
                  );
                })}
              </View>
            ) : (
              <AppText variant="caption" muted style={{ marginTop: 8 }}>
                Kept out of what’s safe to spend. 10% of your pay is a good start.
              </AppText>
            )}
          </View>

          {arrival && setAsideCents && targetCents ? (
            <Appear distance={6}>
              <View style={styles.plan}>
                <AppText>
                  At {formatMoney(setAsideCents, currency, { compact: true })} a month, you’ll have {goalWords(goalName).saving} around{' '}
                  <AppText weight="medium">{monthName(arrival, t)}</AppText>.
                </AppText>
                <PlanStrip from={startOfMonth(t)} to={arrival} />
              </View>
            </Appear>
          ) : null}
        </Appear>
      )}

      {step === 2 && (
        <Appear key="s2" distance={12}>
          <AppText variant="headline" accessibilityRole="header" style={{ marginTop: 36 }}>
            AI, only if you want it
          </AppText>
          <AppText muted style={{ marginTop: 14 }}>
            Your entries are private to your account and kept in sync on your phone, iPad and Mac. No bank login, and we never sell your data.
          </AppText>
          <View style={styles.consent}>
            <View style={styles.consentHead}>
              <View style={{ flex: 1 }}>
                <AppText weight="medium">Allow AI features</AppText>
                <AppText variant="caption" muted>
                  Receipt scanning, buy checks, reviews
                </AppText>
              </View>
              <Switch value={aiConsent} onValueChange={setAiConsent} label="Allow AI features" />
            </View>
            <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: colors.line }}>
              <DisclosureList size={14} />
            </View>
          </View>
          <AppText variant="caption" muted style={{ marginTop: 12 }}>
            You can change this any time in Settings.
          </AppText>
        </Appear>
      )}

      {error && (
        <Appear distance={4}>
          <Notice tone="alert" style={{ marginTop: 24 }}>
            {error}
          </Notice>
        </Appear>
      )}

      <View style={{ marginTop: 'auto', paddingTop: 40 }}>
        {step < 2 ? (
          <Button title="Continue" onPress={next} />
        ) : (
          <Button title={name.trim() ? `Start, ${name.trim()}` : 'Start'} onPress={finish} loading={saving} />
        )}
        {step > 0 && <TextLink label="Back" onPress={back} style={{ alignSelf: 'center', marginTop: 12 }} />}
      </View>
    </Screen>
  );
}

/** "1 / 3" and three short lines that fill in as you go. */
function Progress({ step }: { step: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }} accessibilityLabel={`Step ${step + 1} of 3`}>
      <AppText variant="index" muted>
        {step + 1} / 3
      </AppText>
      <View style={{ flex: 1, flexDirection: 'row', gap: 4 }}>
        {[0, 1, 2].map((i) => (
          <Segment key={i} on={i <= step} />
        ))}
      </View>
    </View>
  );
}

function Segment({ on }: { on: boolean }) {
  const moving = useMotion();
  const p = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    p.set(moving ? withTiming(on ? 1 : 0, timing(motion.standard)) : on ? 1 : 0);
  }, [on, moving, p]);
  const style = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(p.value, [0, 1], [colors.rule, colors.ink]) }));
  return <Animated.View style={[{ flex: 1, height: 2 }, style]} />;
}

function Point({ kind, bold, text }: { kind: 'need' | 'want' | 'income'; bold: string; text: string }) {
  return (
    <View style={{ flexDirection: 'row' }}>
      <View style={{ width: 22, paddingTop: 6 }}>
        <Mark kind={kind} size={10} />
      </View>
      <AppText style={{ flex: 1 }}>
        <AppText weight="medium">{bold}</AppText> {text}
      </AppText>
    </View>
  );
}

/** The months between now and the goal, as a dashed strip: planned, not happened yet. */
function PlanStrip({ from, to }: { from: string; to: string }) {
  const months: string[] = [];
  for (let m = from; m <= to && months.length < 24; m = addMonths(m, 1)) months.push(m);
  const short = months.length > 8;
  return (
    <View style={{ marginTop: 14 }} accessibilityLabel={`${months.length} months of saving`}>
      <View style={styles.strip}>
        {months.map((m, i) => (
          <View key={m} style={{ flex: 1, borderRightWidth: i < months.length - 1 ? 1 : 0, borderColor: colors.ink, borderStyle: 'dashed' }} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', marginTop: 6 }}>
        {months.map((m, i) => (
          <AppText key={m} variant="axis" center style={{ flex: 1, lineHeight: 14, color: i === months.length - 1 ? colors.ink : colors.grey }}>
            {short && i !== 0 && i !== months.length - 1 ? '' : parseISODate(m).toLocaleDateString(undefined, { month: 'short' })}
          </AppText>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 36, paddingTop: 24, borderTopWidth: 1, borderTopColor: colors.rule },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  payRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  plan: { marginTop: 28, padding: 16, backgroundColor: colors.page, borderWidth: 1, borderColor: colors.rule },
  strip: { flexDirection: 'row', height: 12, borderWidth: 1, borderColor: colors.ink, borderStyle: 'dashed' },
  consent: { marginTop: 32, backgroundColor: colors.page, borderWidth: 1, borderColor: colors.rule },
  consentHead: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16 },
});
