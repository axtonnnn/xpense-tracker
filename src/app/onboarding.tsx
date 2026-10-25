import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { View } from 'react-native';

import { AI_DISCLOSURE } from '@/components/ConsentSheet';
import { IncomeMark, NeedMark, WantMark } from '@/components/sketch';
import { AppText, Banner, Button, Card, Chip, Field, Row, Screen, TextTabs, Toggle } from '@/components/ui';
import { setSettings } from '@/db/settings';
import { useUser } from '@/lib/auth';
import { centsToInput, CURRENCIES, formatMoney, parseAmount } from '@/lib/money';
import { colors, space } from '@/theme/tokens';

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

type PayEvery = 'month' | 'week';
const WEEKS_PER_MONTH = 52 / 12;

export default function Onboarding() {
  const db = useSQLiteContext();
  const user = useUser();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(user.name ?? '');
  const [savingFor, setSavingFor] = useState('');
  const [currency, setCurrency] = useState(guessCurrency);
  const [pay, setPay] = useState('');
  const [every, setEvery] = useState<PayEvery>('month');
  const [hours, setHours] = useState('');
  const [goal, setGoal] = useState('');
  const [aiConsent, setAiConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const payCents = parseAmount(pay);
  const monthlyCents = payCents === null ? null : every === 'week' ? Math.round(payCents * WEEKS_PER_MONTH) : payCents;

  const finish = async () => {
    const h = Number(hours);
    await setSettings(db, {
      name: name.trim().slice(0, 40),
      saving_for: savingFor.trim().slice(0, 60),
      currency,
      monthly_income_cents: monthlyCents ?? 0,
      savings_goal_cents: parseAmount(goal) ?? 0,
      hours_per_week: Number.isFinite(h) && h > 0 ? Math.min(h, 100) : 40,
      ai_consent: aiConsent,
      onboarded: true,
    });
    router.replace('/');
  };

  const next = () => {
    setError(null);
    if (step === 1) {
      const g = parseAmount(goal);
      if (pay && (payCents === null || payCents < 0)) return setError('Write your pay as a number, or leave it empty for now.');
      if (g !== null && monthlyCents !== null && g > monthlyCents) return setError('Your savings goal is more than you earn in a month.');
    }
    setStep((s) => s + 1);
  };

  return (
    <Screen topInset contentStyle={{ maxWidth: 520 }}>
      <Row style={{ gap: 6 }} accessibilityLabel={`Step ${step + 1} of 3`}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ width: i === step ? 28 : 10, height: 3, borderRadius: 2, backgroundColor: i <= step ? colors.ink : colors.sand }} />
        ))}
      </Row>

      {step === 0 && (
        <View style={{ gap: 20, paddingTop: space.lg }}>
          <AppText variant="note" muted>
            page one
          </AppText>
          <AppText variant="display" accessibilityRole="header">
            What should we call you?
          </AppText>
          <Field label="Your first name" value={name} onChangeText={setName} placeholder="e.g. Sam" autoComplete="given-name" textContentType="givenName" maxLength={40} />
          <Field
            label="Saving up for something? (optional)"
            value={savingFor}
            onChangeText={setSavingFor}
            placeholder="e.g. a car, moving out, a new laptop"
            maxLength={60}
          />
          <Card seed="welcome">
            <Row style={{ gap: 12, alignItems: 'flex-start' }}>
              <View style={{ marginTop: 5 }}>
                <NeedMark />
              </View>
              <AppText style={{ flex: 1, fontSize: 15, lineHeight: 22 }}>
                <AppText weight="semibold" style={{ fontSize: 15 }}>
                  Needs first.
                </AppText>{' '}
                See what’s safe to spend after rent, bills and saving.
              </AppText>
            </Row>
            <Row style={{ gap: 12, alignItems: 'flex-start' }}>
              <View style={{ marginTop: 5 }}>
                <WantMark />
              </View>
              <AppText style={{ flex: 1, fontSize: 15, lineHeight: 22 }}>
                <AppText weight="semibold" style={{ fontSize: 15 }}>
                  Wants, honestly.
                </AppText>{' '}
                Every receipt sorted, without the guilt.
              </AppText>
            </Row>
            <Row style={{ gap: 12, alignItems: 'flex-start' }}>
              <View style={{ marginTop: 5 }}>
                <IncomeMark />
              </View>
              <AppText style={{ flex: 1, fontSize: 15, lineHeight: 22 }}>
                <AppText weight="semibold" style={{ fontSize: 15 }}>
                  Your pay, your pace.
                </AppText>{' '}
                Weekly shifts or a monthly salary, it all works.
              </AppText>
            </Row>
          </Card>
          <Button title="Continue" onPress={next} />
        </View>
      )}

      {step === 1 && (
        <View style={{ gap: 20, paddingTop: space.lg }}>
          <AppText variant="note" muted>
            page two
          </AppText>
          <AppText variant="display" accessibilityRole="header">
            Your money
          </AppText>
          <AppText muted>This sets up what’s safe to spend. You can change it any time in Settings.</AppText>
          <View style={{ gap: space.sm }}>
            <AppText variant="caption" muted>
              Currency
            </AppText>
            <Row style={{ flexWrap: 'wrap', gap: 8 }}>
              {CURRENCIES.map((code) => (
                <Chip key={code} label={code} selected={currency === code} onPress={() => setCurrency(code)} />
              ))}
            </Row>
          </View>
          <View style={{ gap: space.md }}>
            <Field label="Take-home pay, after tax" value={pay} onChangeText={setPay} keyboardType="decimal-pad" placeholder={every === 'week' ? 'e.g. 450' : 'e.g. 1800'} />
            <TextTabs
              options={[
                { value: 'month', label: 'per month' },
                { value: 'week', label: 'per week' },
              ]}
              value={every}
              onChange={setEvery}
            />
            {every === 'week' && monthlyCents ? (
              <AppText variant="note" muted>
                about {formatMoney(monthlyCents, currency, { compact: true })} a month
              </AppText>
            ) : null}
          </View>
          <Field
            label="Hours you work in a week (optional)"
            value={hours}
            onChangeText={setHours}
            keyboardType="number-pad"
            placeholder="e.g. 20"
            hint="Shows prices as hours of your work."
          />
          <Field
            label={savingFor.trim() ? `How much to save each month for ${savingFor.trim()}?` : 'How much do you want to save each month?'}
            value={goal}
            onChangeText={setGoal}
            keyboardType="decimal-pad"
            placeholder="e.g. 200"
          />
          {monthlyCents ? (
            <Row style={{ flexWrap: 'wrap', gap: 8, marginTop: -8 }}>
              {[0.1, 0.2, 0.3].map((p) => {
                const cents = Math.round(monthlyCents * p);
                return (
                  <Chip
                    key={p}
                    label={`${p * 100}% · ${formatMoney(cents, currency, { compact: true })}`}
                    selected={parseAmount(goal) === cents}
                    onPress={() => setGoal(centsToInput(cents))}
                  />
                );
              })}
            </Row>
          ) : null}
          {error && <Banner tone="danger">{error}</Banner>}
          <Button title="Continue" onPress={next} />
          <Button title="Back" kind="ghost" onPress={() => setStep(0)} />
        </View>
      )}

      {step === 2 && (
        <View style={{ gap: 20, paddingTop: space.lg }}>
          <AppText variant="note" muted>
            last page
          </AppText>
          <AppText variant="display" accessibilityRole="header">
            AI, only if you want it
          </AppText>
          <AppText muted>
            Your entries are private to your account and kept in sync on your phone, iPad and Mac. No bank login, and we never sell your data.
          </AppText>
          <Card seed="consent">
            <Row style={{ justifyContent: 'space-between', gap: space.md }}>
              <AppText weight="semibold" style={{ flex: 1 }}>
                Allow AI features
              </AppText>
              <Toggle value={aiConsent} onValueChange={setAiConsent} label="Allow AI features" />
            </Row>
            {AI_DISCLOSURE.map((line) => (
              <AppText key={line} variant="caption" muted style={{ fontSize: 14, lineHeight: 20 }}>
                {line}
              </AppText>
            ))}
          </Card>
          <Button title={name.trim() ? `Start, ${name.trim()}` : 'Start'} onPress={finish} />
          <Button title="Back" kind="ghost" onPress={() => setStep(1)} />
        </View>
      )}
    </Screen>
  );
}
