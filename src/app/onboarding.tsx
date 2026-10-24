import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon, Logo } from '@/components/brand';
import { AI_DISCLOSURE } from '@/components/ConsentSheet';
import { AppText, Banner, Button, Card, Chip, Field, IconCircle, Row, Screen, Toggle, type IconName } from '@/components/ui';
import { setSettings } from '@/db/settings';
import { centsToInput, CURRENCIES, formatMoney, parseAmount } from '@/lib/money';
import { space, useColors } from '@/theme/tokens';

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

export default function Onboarding() {
  const db = useSQLiteContext();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [currency, setCurrency] = useState(guessCurrency);
  const [income, setIncome] = useState('');
  const [goal, setGoal] = useState('');
  const [aiConsent, setAiConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const values: { icon: IconName; title: string; body: string; tint: [string, string] }[] = [
    { icon: 'stats-chart', title: 'See your progress', body: 'Income, spending and savings in one simple chart.', tint: [c.incomeSoft, c.income] },
    { icon: 'sparkles', title: 'Let AI do the typing', body: 'Snap a receipt or bill and every item is added for you.', tint: [c.wantSoft, c.wantInk] },
    { icon: 'shield-checkmark', title: 'Needs first, wants second', body: 'Know what is safe to spend before you spend it.', tint: [c.needSoft, c.needInk] },
  ];

  const finish = async () => {
    await setSettings(db, {
      currency,
      monthly_income_cents: parseAmount(income) ?? 0,
      savings_goal_cents: parseAmount(goal) ?? 0,
      ai_consent: aiConsent,
      onboarded: true,
    });
    router.replace('/');
  };

  const next = () => {
    setError(null);
    if (step === 1) {
      const inc = parseAmount(income);
      const g = parseAmount(goal);
      if (income && (inc === null || inc < 0)) return setError('Enter your income as a number, or leave it empty.');
      if (g !== null && inc !== null && g > inc) return setError('Your savings goal is higher than your income.');
    }
    setStep((s) => s + 1);
  };

  const incomeCents = parseAmount(income);

  return (
    <Screen contentStyle={{ paddingTop: insets.top + space.lg }}>
      <Row style={{ justifyContent: 'center', gap: 6 }}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ width: i === step ? 26 : 8, height: 8, borderRadius: 4, backgroundColor: i <= step ? c.primary : c.border }} />
        ))}
      </Row>

      {step === 0 && (
        <View style={{ gap: space.xl, paddingTop: space.lg }}>
          <View style={{ alignItems: 'center', gap: space.lg }}>
            <AppIcon size={104} />
            <Logo size={30} mark={false} />
            <AppText variant="display" center style={{ fontSize: 32, lineHeight: 38 }}>
              Spend on what matters
            </AppText>
            <AppText muted center>
              Xpense keeps your money safe for real needs, and helps you spend less on wants.
            </AppText>
          </View>
          <Card style={{ gap: space.lg }}>
            {values.map((v) => (
              <Row key={v.title} style={{ gap: space.md, alignItems: 'flex-start' }}>
                <IconCircle icon={v.icon} size={40} bg={v.tint[0]} color={v.tint[1]} />
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText weight="bold">{v.title}</AppText>
                  <AppText variant="caption" muted>
                    {v.body}
                  </AppText>
                </View>
              </Row>
            ))}
          </Card>
          <Button title="Get started" icon="arrow-forward" onPress={next} />
        </View>
      )}

      {step === 1 && (
        <View style={{ gap: space.lg, paddingTop: space.lg }}>
          <IconCircle icon="wallet" size={52} />
          <AppText variant="display">Your money</AppText>
          <AppText muted>This sets up your safe-to-spend. You can change it any time in Settings.</AppText>
          <View style={{ gap: space.sm }}>
            <AppText variant="label" muted>
              Currency
            </AppText>
            <Row style={{ flexWrap: 'wrap' }}>
              {CURRENCIES.map((code) => (
                <Chip key={code} label={code} selected={currency === code} onPress={() => setCurrency(code)} />
              ))}
            </Row>
          </View>
          <Field label="Monthly income after tax" icon="trending-up" value={income} onChangeText={setIncome} keyboardType="decimal-pad" placeholder="e.g. 3200" />
          <Field label="How much do you want to save each month?" icon="leaf-outline" value={goal} onChangeText={setGoal} keyboardType="decimal-pad" placeholder="e.g. 400" />
          {incomeCents ? (
            <Row style={{ flexWrap: 'wrap' }}>
              {[0.1, 0.2, 0.3].map((p) => {
                const cents = Math.round(incomeCents * p);
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
          <Button title="Continue" icon="arrow-forward" onPress={next} />
          <Button title="Back" kind="ghost" onPress={() => setStep(0)} />
        </View>
      )}

      {step === 2 && (
        <View style={{ gap: space.lg, paddingTop: space.lg }}>
          <IconCircle icon="shield-checkmark" size={52} bg={c.needSoft} color={c.needInk} />
          <AppText variant="display">Private by design</AppText>
          <Card>
            <Row style={{ alignItems: 'flex-start', gap: space.md }}>
              <IconCircle icon="phone-portrait-outline" size={36} />
              <AppText style={{ flex: 1 }}>Your transactions live only on this phone. No account, no bank login, no selling of data.</AppText>
            </Row>
          </Card>
          <Card>
            <Row style={{ justifyContent: 'space-between', gap: space.md }}>
              <Row style={{ flex: 1, gap: space.md }}>
                <IconCircle icon="sparkles" size={36} bg={c.wantSoft} color={c.wantInk} />
                <AppText weight="bold" style={{ flex: 1 }}>
                  Allow AI features
                </AppText>
              </Row>
              <Toggle value={aiConsent} onValueChange={setAiConsent} label="Allow AI features" />
            </Row>
            {AI_DISCLOSURE.map((line) => (
              <AppText key={line} variant="caption" muted>
                {line}
              </AppText>
            ))}
          </Card>
          <Button title="Start saving" icon="leaf" onPress={finish} />
          <Button title="Back" kind="ghost" onPress={() => setStep(1)} />
        </View>
      )}
    </Screen>
  );
}
