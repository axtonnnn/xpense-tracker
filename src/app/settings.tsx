import Constants from 'expo-constants';
import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Linking, Platform, Text, View } from 'react-native';

import { SketchCircle } from '@/components/sketch';
import { useToast } from '@/components/Toast';
import { AppText, Button, Card, Chip, Divider, Field, Label, ListRow, Row, Screen, Toggle } from '@/components/ui';
import { setSettings, useSettings, type Settings } from '@/db/settings';
import { useSync } from '@/db/SyncProvider';
import { allTransactions, deleteAllData } from '@/db/transactions';
import { ApiError, deleteAccountOnServer } from '@/lib/api';
import { useAuth, useUser } from '@/lib/auth';
import { PRIVACY_URL, PRO_MONTHLY_SCANS, SUPPORT_URL, TERMS_URL } from '@/lib/config';
import { confirm, notify } from '@/lib/confirm';
import { today } from '@/lib/dates';
import { shareCSV } from '@/lib/export';
import { centsToInput, CURRENCIES, parseAmount } from '@/lib/money';
import { usePro, useRequirePro } from '@/lib/pro';
import { loadSampleData } from '@/lib/sample-data';
import { colors, fonts, space } from '@/theme/tokens';

export default function SettingsScreen() {
  const settings = useSettings();
  if (!settings) return <Screen>{null}</Screen>;
  return <SettingsForm settings={settings} />;
}

function syncLine(status: ReturnType<typeof useSync>['status'], at: Date | null): string {
  if (status === 'local') return 'Preview account: nothing leaves this device';
  if (status === 'syncing') return 'Syncing…';
  if (status === 'offline') return 'Offline: changes will sync when you’re back online';
  if (!at) return 'Synced';
  const mins = Math.round((Date.now() - at.getTime()) / 60000);
  return mins < 1 ? 'Synced just now' : `Synced ${mins} min ago`;
}

function SettingsForm({ settings }: { settings: Settings }) {
  const db = useSQLiteContext();
  const toast = useToast();
  const pro = usePro();
  const requirePro = useRequirePro();
  const user = useUser();
  const { signOut } = useAuth();
  const sync = useSync();
  const [name, setName] = useState(settings.name || user.name || '');
  const [savingFor, setSavingFor] = useState(settings.savingFor);
  const [currency, setCurrency] = useState(settings.currency);
  const [otherCurrency, setOtherCurrency] = useState(!CURRENCIES.includes(settings.currency));
  const [income, setIncome] = useState(settings.monthlyIncomeCents ? centsToInput(settings.monthlyIncomeCents) : '');
  const [goal, setGoal] = useState(settings.savingsGoalCents ? centsToInput(settings.savingsGoalCents) : '');
  const [hours, setHours] = useState(String(settings.hoursPerWeek));
  const [busy, setBusy] = useState<string | null>(null);

  const saveYou = async () => {
    await setSettings(db, { name: name.trim().slice(0, 40), saving_for: savingFor.trim().slice(0, 60) });
    toast({ message: 'Saved' });
  };

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
        notify('Set up Face ID or a passcode first', 'Your device needs Face ID, Touch ID, a fingerprint or a passcode to lock Xpense.');
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

  const restore = async () => {
    setBusy('restore');
    try {
      const active = await pro.restore();
      notify(
        active ? 'Pro restored' : 'No subscription found',
        active ? 'Welcome back to Xpense Pro.' : 'We couldn’t find an active Pro subscription for this Apple ID or Google account.',
      );
    } catch (e) {
      notify('Restore failed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const doSignOut = async () => {
    setBusy('signout');
    try {
      await sync.syncNow();
      const left = await sync.pending();
      if (
        left > 0 &&
        !(await confirm(
          'Some changes haven’t synced',
          `${left} ${left === 1 ? 'change hasn’t' : 'changes haven’t'} reached your account yet. They stay on this device and sync next time you sign in here.`,
          'Sign out anyway',
        ))
      ) {
        return;
      }
      await signOut();
    } finally {
      setBusy(null);
    }
  };

  const deleteAccount = async () => {
    const ok = await confirm(
      'Delete your account?',
      'This deletes your account and everything in it from all your devices: entries, receipts, repeats and settings. It can’t be undone. If you subscribe to Pro, also cancel it in your App Store or Google Play account.',
      'Delete account',
    );
    if (!ok) return;
    setBusy('delete');
    try {
      if (user.provider !== 'preview') await deleteAccountOnServer();
      await deleteAllData(db);
      await signOut();
    } catch (e) {
      notify('Couldn’t delete your account', e instanceof ApiError ? e.message : 'Please check your connection and try again.');
    } finally {
      setBusy(null);
    }
  };

  const toggle = (value: boolean, onChange: (v: boolean) => void, label: string) => <Toggle value={value} onValueChange={onChange} label={label} />;
  const shownName = settings.name || user.name || user.email?.split('@')[0] || 'You';

  return (
    <Screen>
      <Section title="Account">
        <Card seed="account" style={{ gap: 14 }}>
          <Row style={{ gap: 14 }}>
            <SketchCircle size={48} seed={83}>
              <Text style={{ fontFamily: fonts.serif, fontSize: 26, color: colors.ink }}>{shownName.slice(0, 1).toUpperCase()}</Text>
            </SketchCircle>
            <View style={{ flex: 1, minWidth: 0 }}>
              <AppText weight="semibold" numberOfLines={1}>
                {shownName}
              </AppText>
              <AppText variant="caption" faint numberOfLines={1}>
                {user.provider === 'apple' ? 'Signed in with Apple' : user.provider === 'email' ? user.email : 'Preview account'}
              </AppText>
            </View>
          </Row>
          <AppText variant="caption" muted>
            {syncLine(sync.status, sync.lastSyncedAt)}
          </AppText>
          <Row style={{ gap: 10 }}>
            {sync.status !== 'local' && (
              <Button title="Sync now" kind="secondary" onPress={() => void sync.syncNow()} loading={sync.status === 'syncing'} style={{ flex: 1, minHeight: 44 }} />
            )}
            <Button title="Sign out" kind="secondary" onPress={doSignOut} loading={busy === 'signout'} style={{ flex: 1, minHeight: 44 }} />
          </Row>
        </Card>
      </Section>

      <Section title="Xpense Pro">
        <Card seed="pro">
          {pro.isPro ? (
            <>
              <AppText variant="title">Thank you</AppText>
              <AppText muted>AI scanning, buy checks, monthly reviews and long-range charts are unlocked on all your devices.</AppText>
              <Button title="Manage subscription" kind="secondary" onPress={() => pro.manage()} />
            </>
          ) : (
            <>
              <AppText variant="title">The full AI toolkit</AppText>
              <AppText muted>
                Up to {PRO_MONTHLY_SCANS} receipt scans a month, “Should I buy this?” against your budget, monthly reviews, yearly trends and CSV export.
              </AppText>
              <Button title="See Pro plans" onPress={() => router.push('/paywall')} />
            </>
          )}
        </Card>
      </Section>

      <Section title="About you">
        <Card seed="you">
          <Field label="First name" value={name} onChangeText={setName} maxLength={40} placeholder="What should we call you?" />
          <Field label="Saving up for" value={savingFor} onChangeText={setSavingFor} maxLength={60} placeholder="e.g. a car, moving out" />
          <Button title="Save" kind="secondary" onPress={saveYou} />
        </Card>
      </Section>

      <Section title="Your money">
        <Card seed="money">
          <AppText variant="caption" muted>
            Currency
          </AppText>
          <Row style={{ flexWrap: 'wrap', gap: 8 }}>
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
              accessibilityLabel="Currency code"
            />
          )}
          {currency.trim().toUpperCase() !== settings.currency && (
            <AppText variant="note" muted style={{ fontSize: 19 }}>
              entries you already saved keep their own currency
            </AppText>
          )}
          <Field
            label="Take-home pay per month (after tax)"
            value={income}
            onChangeText={setIncome}
            keyboardType="decimal-pad"
            placeholder="0.00"
            hint="Used for what’s safe to spend until this month’s pay is in."
          />
          <Field label="Savings goal per month" value={goal} onChangeText={setGoal} keyboardType="decimal-pad" placeholder="0.00" hint="Set aside first. A common goal is 10–20% of your pay." />
          <Field label="Hours you work per week" value={hours} onChangeText={setHours} keyboardType="number-pad" hint="Shows prices as hours of your work." />
          <Button title="Save" onPress={saveMoney} />
        </Card>
      </Section>

      <Section title="On this device">
        <Card seed="device" style={{ gap: 0, paddingVertical: space.sm }}>
          {Platform.OS !== 'web' && (
            <>
              <ListRow
                title="Lock with Face ID or passcode"
                subtitle="Ask to unlock every time Xpense opens."
                right={toggle(settings.appLock, toggleLock, 'Lock with Face ID or passcode')}
              />
              <Divider />
            </>
          )}
          <ListRow
            title="Allow AI features"
            subtitle="Off means nothing is ever sent to the AI from this device."
            right={toggle(settings.aiConsent, (on) => setSettings(db, { ai_consent: on }), 'Allow AI features')}
          />
        </Card>
      </Section>

      <Section title="More">
        <Card seed="more" style={{ gap: 0, paddingVertical: space.sm }}>
          <ListRow
            title="Export as CSV"
            subtitle={pro.isPro ? 'A spreadsheet of every entry' : 'Pro'}
            onPress={exportCSV}
            right={busy === 'export' ? <ActivityIndicator color={colors.ink} /> : undefined}
          />
          <Divider />
          <ListRow
            title="Restore purchases"
            subtitle={pro.storeReady ? 'Bought Pro with another account?' : 'Available in the App Store version'}
            onPress={pro.storeReady ? restore : undefined}
            right={busy === 'restore' ? <ActivityIndicator color={colors.ink} /> : undefined}
          />
          {SUPPORT_URL ? (
            <>
              <Divider />
              <ListRow title="Help & support" onPress={() => Linking.openURL(SUPPORT_URL)} />
            </>
          ) : null}
          {PRIVACY_URL ? (
            <>
              <Divider />
              <ListRow title="Privacy policy" onPress={() => Linking.openURL(PRIVACY_URL)} />
            </>
          ) : null}
          {TERMS_URL ? (
            <>
              <Divider />
              <ListRow title="Terms of use" onPress={() => Linking.openURL(TERMS_URL)} />
            </>
          ) : null}
        </Card>
      </Section>

      <Button title="Delete account" kind="danger" onPress={deleteAccount} loading={busy === 'delete'} />

      {__DEV__ && (
        <Section title="Developer">
          <Card seed="dev" style={{ gap: 0, paddingVertical: space.sm }}>
            <ListRow
              title="Simulate Pro"
              subtitle="Development builds only."
              right={toggle(settings.devPro, (on) => setSettings(db, { dev_pro: on }), 'Simulate Pro')}
            />
            <Divider />
            <ListRow
              title="Load sample data"
              subtitle="About three months of a first job, living alone."
              right={busy === 'sample' ? <ActivityIndicator color={colors.ink} /> : undefined}
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

      <View style={{ alignItems: 'center', gap: 2 }}>
        <AppText variant="caption" faint>
          Xpense {Constants.expoConfig?.version ?? ''}
        </AppText>
        <AppText variant="caption" faint selectable style={{ fontSize: 11 }}>
          Account ID: {user.id}
        </AppText>
      </View>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <Label>{title}</Label>
      {children}
    </View>
  );
}
