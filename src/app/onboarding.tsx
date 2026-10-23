import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AI_DISCLOSURE } from '@/components/ConsentSheet';
import { AppText, Banner, Button, Card, Chip, Field, Row, Screen, type IconName } from '@/components/ui';
import { setSettings } from '@/db/settings';
import { CURRENCIES, parseAmount } from '@/lib/money';
import { space, useColors } from '@/theme/tokens';

const VALUES: { icon: IconName; title: string; body: string }[] = [
  { icon: 'stats-chart-outline', title: 'See your progress', body: 'Income, spending and savings in one simple chart.' },
  { icon: 'sparkles-outline', title: 'Let AI do the typing', body: 'Snap a receipt or bill and every item is added for you.' },
  { icon: 'shield-checkmark-outline', title: 'Needs first, wants second', body: 'Know what is safe to spend before you spend it.' },
];

function guessCurrency(): string {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? '';
    const region = locale.split('-').pop()?.toUpperCase();
    const map: Record<string, string> = { US: 'USD', GB: 'GBP', CA: 'CAD', AU: 'AUD', IN: 'INR', JP: 'JPY', MX: 'MXN', BR: 'BRL', NG: 'NGN', ZA: 'ZAR', PH: 'PHP', DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', IE: 'EUR' };
    return (region && map[region]) || 'USD';
  } catch {
    return 'USD';
  }
}

export default function Onboarding() {
  const db = useSQLiteContext();
  const c = useColors();
  const [step, setStep] = useState(0);
  const [currency, setCurrency] = useState(guessCurrency);
  const [income, setIncome] = useState('');
  const [goal, setGoal] = useState('');
  const [aiConsent, setAiConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const suggested = parseAmount(income);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <Screen>
        <Row style={{ justifyContent: 'center', gap: 6, paddingTop: space.sm }}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={{ width: i === step ? 24 : 8, height: 8, borderRadius: 4, backgroundColor: i <= step ? c.primary : c.border }}
            />
          ))}
        </Row>

        {step === 0 && (
          <View style={{ gap: space.xl, paddingTop: space.xl }}>
            <View style={{ alignItems: 'center', gap: space.md }}>
              <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="shield-checkmark" size={44} color={c.primary} />
                <Ionicons name="leaf" size={20} color={c.need} style={{ position: 'absolute', bottom: 14, right: 12 }} />
              </View>
              <AppText variant="display" style={{ textAlign: 'center' }}>
                Spend on what matters
              </AppText>
              <AppText muted style={{ textAlign: 'center' }}>
                Xpense helps you keep money safe for real needs, and spend less on wants.
              </AppText>
            </View>
            {VALUES.map((v) => (
              <Row key={v.title} style={{ gap: space.md, alignItems: 'flex-start' }}>
                <Ionicons name={v.icon} size={24} color={c.primary} />
                <View style={{ flex: 1 }}>
                  <AppText style={{ fontWeight: '700' }}>{v.title}</AppText>
                  <AppText muted>{v.body}</AppText>
                </View>
              </Row>
            ))}
            <Button title="Get started" onPress={next} />
          </View>
        )}

        {step === 1 && (
          <View style={{ gap: space.lg, paddingTop: space.lg }}>
            <AppText variant="display">Your money</AppText>
            <AppText muted>This sets up your safe-to-spend. You can change it any time.</AppText>
            <View style={{ gap: space.sm }}>
              <AppText variant="caption" muted>
                Currency
              </AppText>
              <Row style={{ flexWrap: 'wrap' }}>
                {CURRENCIES.map((code) => (
                  <Chip key={code} label={code} selected={currency === code} onPress={() => setCurrency(code)} />
                ))}
              </Row>
            </View>
            <Field
              label="Monthly income after tax"
              value={income}
              onChangeText={setIncome}
              keyboardType="decimal-pad"
              placeholder="e.g. 3200"
            />
            <Field
              label="How much do you want to save each month?"
              value={goal}
              onChangeText={setGoal}
              keyboardType="decimal-pad"
              placeholder={suggested ? `Tip: 20% would be ${(suggested / 500).toFixed(0)}` : 'e.g. 400'}
            />
            {error && <Banner tone="danger">{error}</Banner>}
            <Button title="Continue" onPress={next} />
            <Button title="Back" kind="ghost" onPress={() => setStep(0)} />
          </View>
        )}

        {step === 2 && (
          <View style={{ gap: space.lg, paddingTop: space.lg }}>
            <AppText variant="display">Private by design</AppText>
            <Card>
              <Row style={{ alignItems: 'flex-start' }}>
                <Ionicons name="phone-portrait-outline" size={20} color={c.primary} style={{ marginTop: 2 }} />
                <AppText style={{ flex: 1 }}>
                  Your transactions live only on this phone. No account, no bank login, no selling of data.
                </AppText>
              </Row>
            </Card>
            <Card>
              <Row style={{ justifyContent: 'space-between' }}>
                <Row style={{ flex: 1 }}>
                  <Ionicons name="sparkles-outline" size={20} color={c.primary} />
                  <AppText style={{ fontWeight: '700', flex: 1 }}>Allow AI features</AppText>
                </Row>
                <Switch value={aiConsent} onValueChange={setAiConsent} trackColor={{ true: c.primary, false: c.border }} accessibilityLabel="Allow AI features" />
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
    </SafeAreaView>
  );
}
