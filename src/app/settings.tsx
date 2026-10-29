import Constants from 'expo-constants';
import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Linking, Platform, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icons';
import { Appear } from '@/components/motion';
import { Dialog, useConfirm } from '@/components/Sheet';
import { sinceText } from '@/components/TabBar';
import { useToast } from '@/components/Toast';
import { AppText, Avatar, Button, Chip, Field, ListRow, PageTitle, ProTag, Rule, Screen, SectionHeader, Switch, TextLink, TopBar } from '@/components/ui';
import { useActiveGoal } from '@/db/goals';
import { setSettings, useSettings, type Settings } from '@/db/settings';
import { useSync } from '@/db/SyncProvider';
import { allTransactions, deleteAllData } from '@/db/transactions';
import { ApiError, deleteAccountOnServer } from '@/lib/api';
import { useAuth, useUser } from '@/lib/auth';
import { PRIVACY_URL, PRO_MONTHLY_SCANS, SUPPORT_URL, TERMS_URL } from '@/lib/config';
import { today } from '@/lib/dates';
import { shareCSV } from '@/lib/export';
import { centsToInput, CURRENCIES, currencySymbol, formatMoney, parseAmount } from '@/lib/money';
import { usePro, useRequirePro } from '@/lib/pro';
import { loadSampleData } from '@/lib/sample-data';
import { colors } from '@/theme/tokens';

const SHOWN_CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];

export default function SettingsScreen() {
  const settings = useSettings();
  if (!settings) return <Screen>{null}</Screen>;
  return <SettingsForm settings={settings} />;
}

function syncLine(status: ReturnType<typeof useSync>['status'], at: Date | null): string {
  if (status === 'local') return 'Preview account: nothing leaves this device';
  if (status === 'syncing') return 'Syncing…';
  if (status === 'offline') return 'Offline: changes sync when you’re back online';
  return at ? `Synced ${sinceText(at)} · on all your devices` : 'Synced · on all your devices';
}

/** A quiet "Saved" that fades in beside a section title after a field saves itself. */
function useSavedNote(): [ReactNode, () => void] {
  const [shown, setShown] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const flash = () => {
    setShown((n) => n + 1);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setShown(0), 1600);
  };
  const note = shown ? (
    <Appear key={shown} distance={0} duration={180}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }} accessibilityLiveRegion="polite">
        <Icon name="done" size={14} color={colors.grey} strokeWidth={1.5} />
        <AppText variant="caption" muted>
          Saved
        </AppText>
      </View>
    </Appear>
  ) : null;
  return [note, flash];
}

function SettingsForm({ settings }: { settings: Settings }) {
  const db = useSQLiteContext();
  const toast = useToast();
  const pro = usePro();
  const requirePro = useRequirePro();
  const user = useUser();
  const goal = useActiveGoal();
  const { signOut } = useAuth();
  const sync = useSync();
  const [dialog, ask] = useConfirm();
  const [name, setName] = useState(settings.name || user.name || '');
  const [moreCurrencies, setMoreCurrencies] = useState(!SHOWN_CURRENCIES.includes(settings.currency));
  const [otherCode, setOtherCode] = useState(CURRENCIES.includes(settings.currency) ? '' : settings.currency);
  const [income, setIncome] = useState(settings.monthlyIncomeCents ? centsToInput(settings.monthlyIncomeCents) : '');
  const [setAside, setSetAside] = useState(settings.savingsGoalCents ? centsToInput(settings.savingsGoalCents) : '');
  const [hours, setHours] = useState(String(settings.hoursPerWeek));
  const [busy, setBusy] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [youNote, youSaved] = useSavedNote();
  const [moneyNote, moneySaved] = useSavedNote();
  const symbol = currencySymbol(settings.currency);

  const saveName = async () => {
    const clean = name.trim().slice(0, 40);
    if (clean === settings.name) return;
    await setSettings(db, { name: clean });
    youSaved();
  };

  const saveMoney = async (patch: Parameters<typeof setSettings>[1]) => {
    await setSettings(db, patch);
    moneySaved();
  };

  const pickCurrency = (code: string) => {
    if (code === settings.currency) return;
    saveMoney({ currency: code });
    toast({ message: 'Entries you already saved keep their own currency.', quiet: true });
  };

  const toggleLock = async (on: boolean) => {
    if (on) {
      const [hasHw, enrolled] = await Promise.all([LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync()]);
      if (!hasHw || !enrolled) {
        toast({ message: 'Set up Face ID, Touch ID or a passcode on this device first.', quiet: true });
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
      toast({ message: e instanceof Error ? e.message : 'Export failed. Please try again.', quiet: true });
    } finally {
      setBusy(null);
    }
  };

  const restore = async () => {
    setBusy('restore');
    try {
      const active = await pro.restore();
      toast({ message: active ? 'Pro restored. Welcome back.' : 'No active Pro subscription was found for this account.', quiet: !active });
    } catch (e) {
      toast({ message: e instanceof Error ? e.message : 'Restore failed. Please try again.', quiet: true });
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
        !(await ask(
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
    setBusy('delete');
    try {
      if (user.provider !== 'preview') await deleteAccountOnServer();
      await deleteAllData(db);
      await signOut();
    } catch (e) {
      setDeleting(false);
      toast({ message: e instanceof ApiError ? e.message : 'Couldn’t delete your account. Check your connection and try again.', quiet: true });
    } finally {
      setBusy(null);
    }
  };

  const shownName = settings.name || user.name || user.email?.split('@')[0] || 'You';

  return (
    <Screen>
      <TopBar onBack={() => router.back()} />
      <PageTitle title="Settings" style={{ marginTop: 24 }} />

      <SectionHeader index="01" title="Account" style={{ marginTop: 40 }} />
      <View style={styles.account}>
        <Avatar name={shownName} size={52} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText weight="medium" numberOfLines={1} style={{ fontSize: 17, lineHeight: 22 }}>
            {shownName}
          </AppText>
          <AppText variant="caption" muted numberOfLines={1}>
            {user.provider === 'apple' ? 'Signed in with Apple' : user.provider === 'email' ? user.email : 'Preview account'}
          </AppText>
        </View>
      </View>
      <View style={styles.syncLine}>
        <Icon name="sync" size={14} color={colors.grey} strokeWidth={1.5} />
        <AppText variant="caption" muted style={{ flex: 1 }}>
          {syncLine(sync.status, sync.lastSyncedAt)}
        </AppText>
      </View>
      <View style={styles.pair}>
        {sync.status !== 'local' && (
          <Button compact title="Sync now" kind="secondary" onPress={() => void sync.syncNow()} loading={sync.status === 'syncing'} style={{ flex: 1 }} />
        )}
        <Button compact title="Sign out" kind="secondary" onPress={doSignOut} loading={busy === 'signout'} style={{ flex: 1 }} />
      </View>

      <Rule />
      <SectionHeader index="02" title="Xpense Pro" />
      {pro.isPro ? (
        <>
          <AppText muted style={{ marginTop: 12 }}>
            Thank you. AI scanning, buy checks, monthly reviews and yearly trends are on for all your devices.
          </AppText>
          <Button title="Manage subscription" kind="secondary" onPress={() => pro.manage()} style={{ marginTop: 16 }} />
        </>
      ) : (
        <>
          <AppText muted style={{ marginTop: 12 }}>
            Up to {PRO_MONTHLY_SCANS} receipt scans a month, “Should I buy this?” against your budget, monthly reviews, yearly trends and CSV export.
          </AppText>
          <Button title="See Pro plans" onPress={() => router.push('/paywall')} style={{ marginTop: 16 }} />
        </>
      )}

      <Rule />
      <View style={styles.headRow}>
        <SectionHeader index="03" title="About you" style={{ flex: 1 }} />
        {youNote}
      </View>
      <View style={{ marginTop: 16 }}>
        <Field label="First name" value={name} onChangeText={setName} onBlur={saveName} onSubmitEditing={saveName} maxLength={40} placeholder="What should we call you?" />
      </View>
      <View style={{ marginTop: 12 }}>
        <ListRow
          over="Saving for"
          title={
            goal
              ? `${goal.goal.name} · ${formatMoney(goal.saved, settings.currency, { compact: true })} of ${formatMoney(goal.goal.target_cents, settings.currency, { compact: true })}`
              : 'Nothing yet'
          }
          onPress={() => (goal ? router.push('/goal') : router.push({ pathname: '/goal/edit', params: { new: '1' } }))}
        />
      </View>

      <Rule />
      <View style={styles.headRow}>
        <SectionHeader index="04" title="Your money" style={{ flex: 1 }} />
        {moneyNote}
      </View>
      <AppText variant="caption" muted style={{ marginTop: 16 }}>
        Currency
      </AppText>
      <View style={styles.chips}>
        {(moreCurrencies ? CURRENCIES : SHOWN_CURRENCIES).map((code) => (
          <Chip key={code} label={code} selected={settings.currency === code} onPress={() => pickCurrency(code)} />
        ))}
        {!moreCurrencies && <Chip label="Other" selected={!SHOWN_CURRENCIES.includes(settings.currency)} onPress={() => setMoreCurrencies(true)} />}
      </View>
      {moreCurrencies && (
        <View style={{ marginTop: 12 }}>
          <Field
            label="Or a 3-letter code"
            value={otherCode}
            onChangeText={(v) => setOtherCode(v.toUpperCase())}
            onBlur={() => /^[A-Z]{3}$/.test(otherCode) && pickCurrency(otherCode)}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={3}
            placeholder="e.g. CHF"
          />
        </View>
      )}
      <View style={{ marginTop: 24 }}>
        <Field
          label="Take-home pay per month, after tax"
          prefix={symbol}
          value={income}
          onChangeText={setIncome}
          onBlur={() => saveMoney({ monthly_income_cents: parseAmount(income) ?? 0 })}
          keyboardType="decimal-pad"
          inputMode="decimal"
          placeholder="0"
          hint="Used for what’s safe to spend until this month’s pay is in."
        />
      </View>
      <View style={{ marginTop: 24 }}>
        <Field
          label="Set aside each month"
          prefix={symbol}
          value={setAside}
          onChangeText={setSetAside}
          onBlur={() => saveMoney({ savings_goal_cents: parseAmount(setAside) ?? 0 })}
          keyboardType="decimal-pad"
          inputMode="decimal"
          placeholder="0"
          hint="Kept out of what’s safe to spend. 10% of your pay is a good start."
        />
      </View>
      <View style={{ marginTop: 24 }}>
        <Field
          label="Hours you work in a week"
          value={hours}
          onChangeText={setHours}
          onBlur={() => {
            const h = Number(hours);
            saveMoney({ hours_per_week: Number.isFinite(h) && h > 0 ? Math.min(h, 100) : 40 });
          }}
          keyboardType="number-pad"
          inputMode="numeric"
          hint="Shows prices as hours of your work. Changes save on their own."
        />
      </View>

      <Rule />
      <SectionHeader index="05" title="On this device" />
      <View style={{ marginTop: 12 }}>
        {Platform.OS !== 'web' && (
          <ListRow
            title="Lock with Face ID"
            subtitle="Ask every time Xpense opens"
            right={<Switch value={settings.appLock} onValueChange={toggleLock} label="Lock with Face ID" />}
          />
        )}
        <ListRow
          title="Allow AI features"
          subtitle="Off means nothing is sent to the AI"
          right={<Switch value={settings.aiConsent} onValueChange={(on) => setSettings(db, { ai_consent: on })} label="Allow AI features" />}
        />
      </View>

      <Rule />
      <SectionHeader index="06" title="More" />
      <View style={{ marginTop: 12 }}>
        <ListRow
          title="Export as CSV"
          tag={pro.isPro ? undefined : <ProTag />}
          onPress={exportCSV}
          right={busy === 'export' ? <ActivityIndicator color={colors.ink} /> : undefined}
        />
        {pro.storeReady && (
          <ListRow title="Restore purchases" onPress={restore} right={busy === 'restore' ? <ActivityIndicator color={colors.ink} /> : undefined} />
        )}
        {SUPPORT_URL ? <ListRow title="Help and support" external onPress={() => Linking.openURL(SUPPORT_URL)} /> : null}
        {PRIVACY_URL ? <ListRow title="Privacy policy" external onPress={() => Linking.openURL(PRIVACY_URL)} /> : null}
        {TERMS_URL ? <ListRow title="Terms of use" external onPress={() => Linking.openURL(TERMS_URL)} /> : null}
      </View>

      {__DEV__ && (
        <>
          <Rule />
          <SectionHeader title="Developer" />
          <View style={{ marginTop: 12 }}>
            <ListRow
              title="Simulate Pro"
              subtitle="Development builds only"
              right={<Switch value={settings.devPro} onValueChange={(on) => setSettings(db, { dev_pro: on })} label="Simulate Pro" />}
            />
            <ListRow
              title="Load sample data"
              subtitle="About three months of a first job, living alone"
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
          </View>
        </>
      )}

      <TextLink label="Delete account" danger onPress={() => setDeleting(true)} style={{ alignSelf: 'flex-start', marginTop: 40 }} />

      <View style={{ alignItems: 'center', marginTop: 32 }}>
        <AppText variant="small" muted>
          Xpense {Constants.expoConfig?.version ?? ''}
        </AppText>
        <AppText variant="index" muted selectable center>
          Account ID {user.id}
        </AppText>
      </View>

      <Dialog open={deleting} onClose={() => busy !== 'delete' && setDeleting(false)} title="Delete your account?">
        <AppText style={{ marginTop: 14 }}>
          This deletes your account and everything in it from all your devices: entries, receipts, repeats, your savings goal and settings. It can’t be undone.
        </AppText>
        <AppText variant="caption" muted style={{ marginTop: 12 }}>
          If you subscribe to Pro, cancel it in the App Store too. Deleting your account doesn’t stop the subscription.
        </AppText>
        <Button title="Delete account" kind="danger" onPress={deleteAccount} loading={busy === 'delete'} style={{ marginTop: 24 }} />
        <Button title="Keep my account" kind="secondary" onPress={() => setDeleting(false)} style={{ marginTop: 10 }} />
      </Dialog>
      {dialog}
    </Screen>
  );
}

const styles = StyleSheet.create({
  account: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 16 },
  syncLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  pair: { flexDirection: 'row', gap: 10, marginTop: 16 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
});
