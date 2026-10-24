import Constants from 'expo-constants';
import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Linking, Platform, View } from 'react-native';

import { useToast } from '@/components/Toast';
import { AppText, Button, Card, Chip, Divider, Field, HeroCard, ListRow, ProBadge, Row, Screen, Toggle } from '@/components/ui';
import { setSettings, useSettings, type Settings } from '@/db/settings';
import { allTransactions, deleteAllData } from '@/db/transactions';
import { PRIVACY_URL, PRO_MONTHLY_SCANS, SUPPORT_URL, TERMS_URL } from '@/lib/config';
import { confirm, notify } from '@/lib/confirm';
import { today } from '@/lib/dates';
import { shareCSV } from '@/lib/export';
import { getInstallId } from '@/lib/install-id';
import { centsToInput, CURRENCIES, parseAmount } from '@/lib/money';
import { usePro, useRequirePro } from '@/lib/pro';
import { loadSampleData } from '@/lib/sample-data';
import { space, useColors } from '@/theme/tokens';

export default function SettingsScreen() {
  const settings = useSettings();
  if (!settings) return <Screen>{null}</Screen>;
  return <SettingsForm settings={settings} />;
}

function SettingsForm({ settings }: { settings: Settings }) {
  const db = useSQLiteContext();
  const c = useColors();
  const toast = useToast();
  const pro = usePro();
  const requirePro = useRequirePro();
  const [currency, setCurrency] = useState(settings.currency);
  const [otherCurrency, setOtherCurrency] = useState(!CURRENCIES.includes(settings.currency));
  const [income, setIncome] = useState(settings.monthlyIncomeCents ? centsToInput(settings.monthlyIncomeCents) : '');
  const [goal, setGoal] = useState(settings.savingsGoalCents ? centsToInput(settings.savingsGoalCents) : '');
  const [hours, setHours] = useState(String(settings.hoursPerWeek));
  const [busy, setBusy] = useState<string | null>(null);
  const [supportId, setSupportId] = useState('');

  useEffect(() => {
    getInstallId().then(setSupportId, () => setSupportId(''));
  }, []);

  const saveMoney = async () => {
    const code = currency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) {
      notify('Check the currency', 'Use a 3-letter code like USD or EUR.');
      return;
    }
    const h = Number(hours);
    await setSettings(db, {
      currency: code,
      monthly_income_cents: parseAmount(income) ?? 0,
      savings_goal_cents: parseAmount(goal) ?? 0,
      hours_per_week: Number.isFinite(h) && h > 0 ? Math.min(h, 100) : 40,
    });
    toast({ message: 'Money settings saved' });
  };

  const toggleLock = async (on: boolean) => {
    if (on) {
      const [hasHw, enrolled] = await Promise.all([LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync()]);
      if (!hasHw || !enrolled) {
        notify('Set up Face ID or a passcode first', 'Your phone needs Face ID, Touch ID, fingerprint or a passcode to lock Xpense.');
        return;
      }
      const res = await LocalAuthentication.authenticateAsync({ promptMessage: 'Turn on app lock' });
      if (!res.success) return;
    }
    await setSettings(db, { app_lock: on });
  };

  const exportCSV = async () => {
    if (!requirePro('csv_export')) return;
    setBusy('export');
    try {
      await shareCSV(await allTransactions(db), `xpense-${today()}.csv`);
    } catch (e) {
      notify('Export failed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const wipe = async () => {
    const ok = await confirm(
      'Delete all data?',
      'Every transaction, receipt photo, repeating item and setting on this phone will be erased. Your Pro subscription is not affected.',
      'Delete everything',
    );
    if (!ok) return;
    await deleteAllData(db);
    router.replace('/onboarding');
  };

  const restore = async () => {
    setBusy('restore');
    try {
      const active = await pro.restore();
      notify(
        active ? 'Pro restored' : 'No subscription found',
        active ? 'Welcome back to Xpense Pro.' : 'We couldn’t find an active Pro subscription for this Apple ID / Google account.',
      );
    } catch (e) {
      notify('Restore failed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const toggle = (value: boolean, onChange: (v: boolean) => void, label: string) => (
    <Toggle value={value} onValueChange={onChange} label={label} />
  );

  return (
    <Screen>
      {pro.isPro ? (
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <AppText variant="title">Xpense Pro</AppText>
            <ProBadge label="ACTIVE" />
          </Row>
          <AppText muted>Thank you! AI scanning, buy checks, monthly reviews and long-range charts are unlocked.</AppText>
          <Button title="Manage subscription" kind="secondary" icon="card-outline" onPress={() => pro.manage()} />
        </Card>
      ) : (
        <HeroCard>
          <Row>
            <ProBadge onHero />
          </Row>
          <AppText variant="title" color={c.onHero}>
            Unlock the full AI toolkit
          </AppText>
          <AppText color={c.onHeroMuted}>
            Up to {PRO_MONTHLY_SCANS} AI receipt scans a month, “Should I buy this?”, monthly reviews, yearly trends and CSV export.
          </AppText>
          <Button title="See Pro plans" icon="sparkles" kind="hero" onPress={() => router.push('/paywall')} />
        </HeroCard>
      )}

      <Section title="Your money">
        <Card>
          <AppText variant="caption" weight="semibold" muted>
            Currency
          </AppText>
          <Row style={{ flexWrap: 'wrap' }}>
            {CURRENCIES.map((code) => (
              <Chip
                key={code}
                label={code}
                selected={!otherCurrency && currency === code}
                onPress={() => {
                  setOtherCurrency(false);
                  setCurrency(code);
                }}
              />
            ))}
            <Chip
              label="Other"
              icon="globe-outline"
              selected={otherCurrency}
              onPress={() => {
                if (!otherCurrency) setCurrency('');
                setOtherCurrency(true);
              }}
            />
          </Row>
          {otherCurrency && (
            <Field
              value={currency}
              onChangeText={setCurrency}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={3}
              placeholder="3-letter code, e.g. CHF"
              icon="globe-outline"
              accessibilityLabel="Currency code"
            />
          )}
          <Field
            label="Expected monthly income (after tax)"
            icon="trending-up"
            value={income}
            onChangeText={setIncome}
            keyboardType="decimal-pad"
            placeholder="0.00"
            hint="Used for safe-to-spend until this month’s income is logged."
          />
          <Field
            label="Monthly savings goal"
            icon="leaf-outline"
            value={goal}
            onChangeText={setGoal}
            keyboardType="decimal-pad"
            placeholder="0.00"
            hint="Set aside first. A common target is 20% of income."
          />
          <Field
            label="Hours you work per week"
            icon="time-outline"
            value={hours}
            onChangeText={setHours}
            keyboardType="number-pad"
            hint="Lets Xpense show prices as hours of work."
          />
          <Button title="Save" icon="checkmark" onPress={saveMoney} />
        </Card>
      </Section>

      <Section title="Privacy & safety">
        <Card style={{ gap: 0, paddingVertical: space.sm }}>
          {Platform.OS !== 'web' && (
            <>
              <ListRow
                icon="lock-closed"
                title="Lock with Face ID or passcode"
                subtitle="Ask to unlock every time Xpense opens."
                right={toggle(settings.appLock, toggleLock, 'Lock with Face ID or passcode')}
              />
              <Divider />
            </>
          )}
          <ListRow
            icon="sparkles"
            tint={{ bg: c.wantSoft, fg: c.wantInk }}
            title="Allow AI features"
            subtitle="Off means nothing is ever sent to the AI."
            right={toggle(settings.aiConsent, (on) => setSettings(db, { ai_consent: on }), 'Allow AI features')}
          />
        </Card>
      </Section>

      <Section title="Your data">
        <Card style={{ gap: 0, paddingVertical: space.sm }}>
          <ListRow
            icon="phone-portrait-outline"
            tint={{ bg: c.needSoft, fg: c.needInk }}
            title="Stored only on this phone"
            subtitle="No account, and your transactions are never uploaded."
          />
          <Divider />
          <ListRow
            icon="download-outline"
            title="Export as CSV"
            subtitle={pro.isPro ? 'A spreadsheet of every entry' : 'Pro feature'}
            onPress={exportCSV}
            right={busy === 'export' ? <ActivityIndicator color={c.primary} /> : undefined}
          />
          <Divider />
          <ListRow icon="trash-outline" title="Delete all data" subtitle="Erase everything on this phone" destructive onPress={wipe} />
        </Card>
      </Section>

      <Section title="About">
        <Card style={{ gap: 0, paddingVertical: space.sm }}>
          {SUPPORT_URL ? (
            <>
              <ListRow icon="help-buoy-outline" title="Help & support" subtitle="Answers, and how to contact us" onPress={() => Linking.openURL(SUPPORT_URL)} />
              <Divider />
            </>
          ) : null}
          <ListRow
            icon="refresh"
            title="Restore purchases"
            subtitle={pro.storeReady ? 'Bought Pro on another phone?' : 'Available in the App Store version'}
            onPress={pro.storeReady ? restore : undefined}
            right={busy === 'restore' ? <ActivityIndicator color={c.primary} /> : undefined}
          />
          {PRIVACY_URL ? (
            <>
              <Divider />
              <ListRow icon="shield-checkmark-outline" title="Privacy policy" onPress={() => Linking.openURL(PRIVACY_URL)} />
            </>
          ) : null}
          {TERMS_URL ? (
            <>
              <Divider />
              <ListRow icon="document-text-outline" title="Terms of use" onPress={() => Linking.openURL(TERMS_URL)} />
            </>
          ) : null}
        </Card>
        <View style={{ alignItems: 'center', gap: 2, marginTop: space.sm }}>
          <AppText variant="caption" muted>
            Xpense {Constants.expoConfig?.version ?? ''}
          </AppText>
          <AppText variant="caption" muted selectable>
            Support ID: {supportId}
          </AppText>
        </View>
      </Section>

      {__DEV__ && (
        <Section title="Developer">
          <Card style={{ gap: 0, paddingVertical: space.sm }}>
            <ListRow
              icon="construct-outline"
              title="Simulate Pro"
              subtitle="Development builds only."
              right={toggle(settings.devPro, (on) => setSettings(db, { dev_pro: on }), 'Simulate Pro')}
            />
            <Divider />
            <ListRow
              icon="flask-outline"
              title="Load sample data"
              subtitle="About three months of realistic entries."
              right={busy === 'sample' ? <ActivityIndicator color={c.primary} /> : undefined}
              onPress={async () => {
                setBusy('sample');
                try {
                  await loadSampleData(db, settings.currency);
                  toast({ message: 'Sample data loaded' });
                } finally {
                  setBusy(null);
                }
              }}
            />
          </Card>
        </Section>
      )}
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <AppText variant="label" muted style={{ marginLeft: space.xs }}>
        {title}
      </AppText>
      {children}
    </View>
  );
}
