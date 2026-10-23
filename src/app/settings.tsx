import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, Switch, View } from 'react-native';

import { AppText, Banner, Button, Card, Chip, Field, ProBadge, Row, Screen, SectionTitle, type IconName } from '@/components/ui';
import { setSettings, useSettings, type Settings } from '@/db/settings';
import { allTransactions, deleteAllData } from '@/db/transactions';
import { PRIVACY_URL, TERMS_URL } from '@/lib/config';
import { confirm, notify } from '@/lib/confirm';
import { today } from '@/lib/dates';
import { shareCSV } from '@/lib/export';
import { getInstallId } from '@/lib/install-id';
import { loadSampleData } from '@/lib/sample-data';
import { centsToInput, CURRENCIES, parseAmount } from '@/lib/money';
import { usePro, useRequirePro } from '@/lib/pro';
import { space, useColors } from '@/theme/tokens';

export default function SettingsScreen() {
  const settings = useSettings();
  if (!settings) return <Screen>{null}</Screen>;
  return <SettingsForm settings={settings} />;
}

function SettingsForm({ settings }: { settings: Settings }) {
  const db = useSQLiteContext();
  const pro = usePro();
  const requirePro = useRequirePro();
  const [currency, setCurrency] = useState(settings.currency);
  const [income, setIncome] = useState(settings.monthlyIncomeCents ? centsToInput(settings.monthlyIncomeCents) : '');
  const [goal, setGoal] = useState(settings.savingsGoalCents ? centsToInput(settings.savingsGoalCents) : '');
  const [hours, setHours] = useState(String(settings.hoursPerWeek));
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [supportId, setSupportId] = useState('');

  useEffect(() => {
    getInstallId().then(setSupportId, () => setSupportId(''));
  }, []);

  const saveMoney = async () => {
    const code = currency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) return setMessage('Currency must be a 3-letter code like USD.');
    const h = Number(hours);
    await setSettings(db, {
      currency: code,
      monthly_income_cents: parseAmount(income) ?? 0,
      savings_goal_cents: parseAmount(goal) ?? 0,
      hours_per_week: Number.isFinite(h) && h > 0 ? Math.min(h, 100) : 40,
    });
    setMessage('Saved.');
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
      notify(active ? 'Pro restored' : 'No subscription found', active ? 'Welcome back to Xpense Pro.' : 'We couldn’t find an active Pro subscription for this Apple ID / Google account.');
    } catch (e) {
      notify('Restore failed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <AppText variant="title">Xpense Pro</AppText>
          {pro.isPro && <ProBadge label="ACTIVE" />}
        </Row>
        <AppText muted>
          {pro.isPro
            ? 'Thank you! AI scanning, buy checks, monthly reviews and long-range charts are unlocked.'
            : 'Unlimited AI receipt scanning, “Should I buy this?”, monthly AI reviews, yearly trends and CSV export.'}
        </AppText>
        {pro.isPro ? (
          <Button title="Manage subscription" kind="secondary" icon="card-outline" onPress={() => pro.manage()} />
        ) : (
          <Button title="See Pro plans" icon="sparkles" onPress={() => router.push('/paywall')} />
        )}
        <Button title="Restore purchases" kind="ghost" onPress={restore} loading={busy === 'restore'} disabled={!pro.storeReady} />
      </Card>

      <SectionTitle>Your money</SectionTitle>
      <View style={{ gap: space.sm }}>
        <AppText variant="caption" muted>
          Currency
        </AppText>
        <Row style={{ flexWrap: 'wrap' }}>
          {CURRENCIES.map((code) => (
            <Chip key={code} label={code} selected={currency === code} onPress={() => setCurrency(code)} />
          ))}
        </Row>
        <Field value={currency} onChangeText={setCurrency} autoCapitalize="characters" maxLength={3} placeholder="Other code" />
      </View>
      <Field
        label="Expected monthly income (after tax)"
        value={income}
        onChangeText={setIncome}
        keyboardType="decimal-pad"
        placeholder="0.00"
        hint="Used for safe-to-spend until this month’s income is logged."
      />
      <Field
        label="Monthly savings goal"
        value={goal}
        onChangeText={setGoal}
        keyboardType="decimal-pad"
        placeholder="0.00"
        hint="Set aside first. A common target is 20% of income."
      />
      <Field
        label="Hours you work per week"
        value={hours}
        onChangeText={setHours}
        keyboardType="number-pad"
        hint="Lets “Should I buy this?” show prices as hours of work."
      />
      {message && <Banner icon="checkmark-circle">{message}</Banner>}
      <Button title="Save" icon="checkmark" onPress={saveMoney} />

      <SectionTitle>Privacy & safety</SectionTitle>
      <Card style={{ gap: space.lg }}>
        {Platform.OS !== 'web' && (
          <SettingSwitch
            icon="lock-closed-outline"
            title="Lock with Face ID / passcode"
            body="Ask to unlock every time Xpense opens."
            value={settings.appLock}
            onChange={toggleLock}
          />
        )}
        <SettingSwitch
          icon="sparkles-outline"
          title="Allow AI features"
          body="Lets AI read receipts you scan and items you check. Off means nothing is ever sent."
          value={settings.aiConsent}
          onChange={(on) => setSettings(db, { ai_consent: on })}
        />
      </Card>

      <SectionTitle>Your data</SectionTitle>
      <Card>
        <AppText muted>All of your data is stored only on this phone. There is no account, and your transactions are never uploaded.</AppText>
        <Button title="Export as CSV" icon="download-outline" kind="secondary" onPress={exportCSV} loading={busy === 'export'} />
        <Button title="Delete all data" icon="trash-outline" kind="danger" onPress={wipe} />
      </Card>

      <SectionTitle>About</SectionTitle>
      <Card style={{ gap: space.md }}>
        {PRIVACY_URL ? <LinkRow label="Privacy policy" url={PRIVACY_URL} /> : null}
        {TERMS_URL ? <LinkRow label="Terms of use" url={TERMS_URL} /> : null}
        <AppText variant="caption" muted selectable>
          Support ID: {supportId}
        </AppText>
        <AppText variant="caption" muted>
          Xpense {Constants.expoConfig?.version ?? ''}
        </AppText>
      </Card>

      {__DEV__ && (
        <>
          <SectionTitle>Developer</SectionTitle>
          <Card>
            <SettingSwitch
              icon="construct-outline"
              title="Simulate Pro"
              body="Development builds only. Unlocks Pro screens without a purchase."
              value={settings.devPro}
              onChange={(on) => setSettings(db, { dev_pro: on })}
            />
            <Button
              title="Load sample data"
              kind="secondary"
              icon="flask-outline"
              loading={busy === 'sample'}
              onPress={async () => {
                setBusy('sample');
                try {
                  await loadSampleData(db, settings.currency);
                  setMessage('Sample data loaded.');
                } finally {
                  setBusy(null);
                }
              }}
            />
          </Card>
        </>
      )}
    </Screen>
  );

}

function SettingSwitch(props: { icon: IconName; title: string; body: string; value: boolean; onChange: (v: boolean) => void }) {
  const c = useColors();
  return (
    <Row style={{ alignItems: 'flex-start' }}>
      <Ionicons name={props.icon} size={20} color={c.primary} style={{ marginTop: 2 }} />
      <View style={{ flex: 1, gap: 2 }}>
        <AppText>{props.title}</AppText>
        <AppText variant="caption" muted>
          {props.body}
        </AppText>
      </View>
      <Switch
        value={props.value}
        onValueChange={props.onChange}
        trackColor={{ true: c.primary, false: c.border }}
        accessibilityLabel={props.title}
      />
    </Row>
  );
}

function LinkRow({ label, url }: { label: string; url: string }) {
  const c = useColors();
  return (
    <Pressable onPress={() => Linking.openURL(url)} accessibilityRole="link">
      <Row style={{ justifyContent: 'space-between' }}>
        <AppText>{label}</AppText>
        <Ionicons name="open-outline" size={18} color={c.inkMuted} />
      </Row>
    </Pressable>
  );
}
