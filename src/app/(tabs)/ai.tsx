import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ConsentSheet } from '@/components/ConsentSheet';
import { Appear, useEntrance } from '@/components/motion';
import { TxRow } from '@/components/money-ui';
import { Viewfinder } from '@/components/pictures';
import { useScanFlow } from '@/components/ScanFlow';
import { AppText, Button, Field, haptic, Notice, PageTitle, ProTag, Rule, Screen, SectionHeader } from '@/components/ui';
import { useLiveQuery } from '@/db/live';
import { setSettings, useSettings } from '@/db/settings';
import { listRecentScans } from '@/db/transactions';
import { ApiError, NeedsProError } from '@/lib/api';
import { FREE_TRIAL_SCANS } from '@/lib/config';
import { formatDay, parseISODate, today } from '@/lib/dates';
import { parseAmount } from '@/lib/money';
import { usePro, useRequirePro } from '@/lib/pro';
import type { PickSource } from '@/lib/scan';
import { useWide } from '@/theme/tokens';

export default function AIMode() {
  const db = useSQLiteContext();
  const settings = useSettings();
  const wide = useWide();
  const { isPro } = usePro();
  const requirePro = useRequirePro();
  const { data: scans } = useLiveQuery((d) => listRecentScans(d, 5), []);
  const scan = useScanFlow(settings?.currency ?? 'USD');
  const entrance = useEntrance();

  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [item, setItem] = useState('');
  const [price, setPrice] = useState('');

  if (!settings) return <Screen>{null}</Screen>;
  const trialLeft = settings.trialRemaining ?? FREE_TRIAL_SCANS;
  const monthName = parseISODate(today()).toLocaleDateString(undefined, { month: 'long' });

  const withConsent = (action: () => void) => {
    if (settings.aiConsent) action();
    else setPendingAction(() => action);
  };

  const fail = (e: unknown, feature: string) => {
    haptic('warning');
    if (e instanceof NeedsProError) {
      if (feature === 'ai_scan') setSettings(db, { trial_remaining: 0 });
      requirePro(feature);
    } else {
      setError(e instanceof ApiError || e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    }
  };

  const startScan = (source: PickSource) => {
    setError(null);
    if (!isPro && trialLeft <= 0) {
      requirePro('ai_scan');
      return;
    }
    withConsent(() => {
      scan.start(source).catch((e) => fail(e, 'ai_scan'));
    });
  };

  const check = () => {
    setError(null);
    const cents = parseAmount(price);
    if (!item.trim() || !cents || cents <= 0) {
      haptic('warning');
      setError('Write what you want to buy and its price.');
      return;
    }
    if (!requirePro('ai_check')) return;
    withConsent(() => router.push({ pathname: '/buy-check', params: { item: item.trim(), price: String(cents) } }));
  };

  const review = () => {
    setError(null);
    if (!requirePro('ai_review')) return;
    withConsent(() => router.push('/month-review'));
  };

  const top = (
    <View>
      <PageTitle
        title="AI mode"
        right={
          <AppText variant="caption" muted style={{ marginBottom: 8 }}>
            {isPro ? 'Pro' : trialLeft > 0 ? `${trialLeft} free ${trialLeft === 1 ? 'scan' : 'scans'} left` : 'Free scans used'}
          </AppText>
        }
      />
      <AppText muted style={{ marginTop: 12 }}>
        Snap a receipt or a bill. The AI types in every line and sorts it into needs and wants.
      </AppText>
      <Appear delay={60} style={{ marginTop: 24 }}>
        <Viewfinder />
      </Appear>
      <AppText variant="caption" muted style={{ marginTop: 10 }}>
        Lay it flat and fill the frame.
      </AppText>
      <Button title="Take photo" icon="camera" onPress={() => startScan('camera')} style={{ marginTop: 24 }} />
      <Button title="Choose from photos" icon="photos" kind="secondary" onPress={() => startScan('library')} style={{ marginTop: 12 }} />
      {error && (
        <Appear distance={4}>
          <Notice tone="alert" style={{ marginTop: 20 }}>
            {error}
          </Notice>
        </Appear>
      )}
    </View>
  );

  const buy = (
    <View>
      <View style={styles.headRow}>
        <SectionHeader index="01" title="Should I buy this?" style={{ flex: 1 }} />
        {!isPro && <ProTag />}
      </View>
      <AppText variant="caption" muted style={{ marginTop: 6 }}>
        Checked against what’s safe to spend this month.
      </AppText>
      <View style={styles.fields}>
        <View style={{ flex: 1 }}>
          <Field label="What is it?" value={item} onChangeText={setItem} placeholder="e.g. wireless earbuds" maxLength={120} />
        </View>
        <View style={{ width: 100 }}>
          <Field label="Price" value={price} onChangeText={setPrice} placeholder="0.00" keyboardType="decimal-pad" inputMode="decimal" />
        </View>
      </View>
      <Button title="Check it" kind="secondary" onPress={check} style={{ marginTop: 20 }} />
    </View>
  );

  const monthly = (
    <View>
      <View style={styles.headRow}>
        <SectionHeader index="02" title={`${monthName} review`} style={{ flex: 1 }} />
        {!isPro && <ProTag />}
      </View>
      <AppText variant="caption" muted style={{ marginTop: 6 }}>
        A short read on your month, with three tips.
      </AppText>
      <Button title="Get my review" kind="secondary" onPress={review} style={{ marginTop: 20 }} />
    </View>
  );

  const recent =
    scans && scans.length > 0 ? (
      <View>
        <SectionHeader index="03" title="Recent scans" />
        <View style={{ marginTop: 12 }}>
          {scans.map((s, i) => (
            <TxRow
              key={s.id}
              tx={s}
              custom={settings.customCategories}
              showDate={formatDay(s.occurred_on, { weekday: 'short', day: 'numeric' })}
              delay={entrance(i)}
              onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: s.id } })}
            />
          ))}
        </View>
      </View>
    ) : null;

  return (
    <Screen full={wide}>
      {wide ? (
        <View style={styles.columns}>
          <View style={{ flex: 1 }}>{top}</View>
          <View style={{ flex: 1, paddingTop: 12 }}>
            {buy}
            <Rule />
            {monthly}
            {recent && (
              <>
                <Rule />
                {recent}
              </>
            )}
          </View>
        </View>
      ) : (
        <>
          {top}
          <Rule />
          {buy}
          <Rule />
          {monthly}
          {recent && (
            <>
              <Rule />
              {recent}
            </>
          )}
        </>
      )}

      <ConsentSheet
        visible={!!pendingAction}
        onAllow={async () => {
          const action = pendingAction;
          setPendingAction(null);
          await setSettings(db, { ai_consent: true });
          // Let the sheet finish closing before the camera or photo picker is presented (iOS).
          setTimeout(() => action?.(), 450);
        }}
        onCancel={() => setPendingAction(null)}
      />
      {scan.element}
    </Screen>
  );
}

const styles = StyleSheet.create({
  columns: { flexDirection: 'row', gap: 48, alignItems: 'flex-start' },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fields: { flexDirection: 'row', gap: 20, marginTop: 20 },
});
