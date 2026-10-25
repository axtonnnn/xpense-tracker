import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Modal, Platform, StyleSheet, View } from 'react-native';

import { LogoMark } from '@/components/brand';
import { ConsentSheet } from '@/components/ConsentSheet';
import { ViewfinderSketch } from '@/components/illustrations';
import { TxRow } from '@/components/money-ui';
import { NeedMark, SketchCircle, SketchRule, Stamp, WantMark } from '@/components/sketch';
import { AppText, Banner, Button, Card, Field, PageTitle, Pill, ProTag, Row, Screen, SectionTitle, tabular } from '@/components/ui';
import type { CheckResult, ReviewResult } from '../../../shared/schemas';
import { useLiveQuery } from '@/db/live';
import { listRecurring } from '@/db/recurring';
import { setSettings, useSettings } from '@/db/settings';
import { listBetween, listRecentScans } from '@/db/transactions';
import { ApiError, checkPurchase, monthlyReview, NeedsProError } from '@/lib/api';
import { categoryBreakdown, hourlyRateCents, hoursOfWork, safeToSpend, totals } from '@/lib/budget';
import { FREE_TRIAL_SCANS } from '@/lib/config';
import { addMonths, endOfMonth, monthKey, parseISODate, startOfMonth, today } from '@/lib/dates';
import { fromCents, parseAmount } from '@/lib/money';
import { usePro, useRequirePro } from '@/lib/pro';
import { pickImage, runScan, type PickSource } from '@/lib/scan';
import { colors, space } from '@/theme/tokens';

const VERDICT = { go: 'go for it', wait: 'sleep on it', skip: 'probably skip' } as const;

export default function AIMode() {
  const db = useSQLiteContext();
  const settings = useSettings();
  const { isPro } = usePro();
  const requirePro = useRequirePro();
  const t = today();
  const monthStart = startOfMonth(t);
  const prevStart = addMonths(monthStart, -1, 1);
  const { data: txs } = useLiveQuery((d) => listBetween(d, prevStart, endOfMonth(t)), [prevStart, t]);
  const { data: recurring } = useLiveQuery(listRecurring, []);
  const { data: scans } = useLiveQuery((d) => listRecentScans(d, 5), []);

  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [busy, setBusy] = useState<null | 'scan' | 'check' | 'review'>(null);
  const [error, setError] = useState<string | null>(null);
  const [item, setItem] = useState('');
  const [price, setPrice] = useState('');
  const [check, setCheck] = useState<(CheckResult & { priceCents: number }) | null>(null);
  const [review, setReview] = useState<ReviewResult | null>(null);

  if (!settings) return <Screen>{null}</Screen>;
  const currency = settings.currency;
  const trialLeft = settings.trialRemaining ?? FREE_TRIAL_SCANS;

  const withConsent = (action: () => void) => {
    if (settings.aiConsent) action();
    else setPendingAction(() => action);
  };

  const fail = (e: unknown, feature: string) => {
    if (e instanceof NeedsProError) {
      if (feature === 'ai_scan') setSettings(db, { trial_remaining: 0 });
      requirePro(feature);
    } else {
      setError(e instanceof ApiError || e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    }
  };

  const scan = (source: PickSource) => {
    setError(null);
    if (!isPro && trialLeft <= 0) {
      requirePro('ai_scan');
      return;
    }
    withConsent(async () => {
      try {
        const asset = await pickImage(source);
        if (!asset) return;
        setBusy('scan');
        const { id, trialRemaining } = await runScan(asset, { currency });
        if (trialRemaining !== null) await setSettings(db, { trial_remaining: trialRemaining });
        router.push({ pathname: '/scan-review', params: { id } });
      } catch (e) {
        fail(e, 'ai_scan');
      } finally {
        setBusy(null);
      }
    });
  };

  const hourly = hourlyRateCents(settings.monthlyIncomeCents, settings.hoursPerWeek);
  const safe =
    txs && recurring
      ? safeToSpend({ today: t, txs, expectedIncomeCents: settings.monthlyIncomeCents, savingsGoalCents: settings.savingsGoalCents, recurring })
      : null;
  const month = txs ? totals(txs, monthStart, endOfMonth(t)) : null;

  const runCheck = () => {
    setError(null);
    const cents = parseAmount(price);
    if (!item.trim() || !cents || cents <= 0) {
      setError('Write what you want to buy and its price.');
      return;
    }
    if (!requirePro('ai_check')) return;
    withConsent(async () => {
      setBusy('check');
      try {
        // Only numbers about this month go along, so the answer fits the person's own budget.
        const budget =
          safe && month && safe.status !== 'unset'
            ? {
                safe_to_spend: fromCents(Math.max(0, safe.amount)),
                days_left: safe.daysLeft,
                monthly_income: safe.income > 0 ? fromCents(safe.income) : null,
                hourly_pay: hourly ? fromCents(hourly) : null,
                savings_goal: settings.savingsGoalCents > 0 ? fromCents(settings.savingsGoalCents) : null,
                saving_for: settings.savingFor.trim().slice(0, 60) || null,
                wants_so_far: fromCents(month.want),
              }
            : null;
        const result = await checkPurchase({ item: item.trim(), price: fromCents(cents), currency, budget });
        setCheck({ ...result, priceCents: cents });
      } catch (e) {
        fail(e, 'ai_check');
      } finally {
        setBusy(null);
      }
    });
  };

  const runReview = () => {
    setError(null);
    if (!requirePro('ai_review') || !txs) return;
    withConsent(async () => {
      setBusy('review');
      try {
        const cur = totals(txs, monthStart, endOfMonth(t));
        const prev = totals(txs, prevStart, endOfMonth(prevStart));
        const result = await monthlyReview({
          month: monthKey(t),
          currency,
          income: fromCents(Math.max(cur.income, settings.monthlyIncomeCents)),
          spent: fromCents(cur.spent),
          need: fromCents(cur.need),
          want: fromCents(cur.want),
          savings_goal: fromCents(settings.savingsGoalCents),
          saving_for: settings.savingFor.trim().slice(0, 60) || null,
          previous: prev.spent > 0 ? { need: fromCents(prev.need), want: fromCents(prev.want) } : null,
          categories: categoryBreakdown(txs, monthStart, endOfMonth(t)).map((b) => ({
            category: b.category.replace(/^custom:/, ''),
            need: fromCents(b.need),
            want: fromCents(b.want),
          })),
        });
        setReview(result);
      } catch (e) {
        fail(e, 'ai_review');
      } finally {
        setBusy(null);
      }
    });
  };

  const hours = check ? hoursOfWork(check.priceCents, hourly) : null;
  const shareOfSafe = check && safe && safe.amount > 0 ? Math.round((check.priceCents / safe.amount) * 100) : null;
  const monthName = parseISODate(t).toLocaleDateString(undefined, { month: 'long' });

  return (
    <Screen topInset>
      <View style={{ gap: 8 }}>
        <PageTitle
          title="AI mode"
          right={
            <AppText variant="note" muted style={{ fontSize: 19, marginBottom: 8 }}>
              {isPro ? 'pro' : trialLeft > 0 ? `${trialLeft} free ${trialLeft === 1 ? 'scan' : 'scans'} left` : 'free scans used'}
            </AppText>
          }
        />
        <AppText muted style={{ fontSize: 15, lineHeight: 22 }}>
          Snap a receipt or a bill. The AI types in every item and sorts it into needs and wants.
        </AppText>
      </View>

      <Card seed="viewfinder" style={{ padding: 0, alignItems: 'center' }}>
        <ViewfinderSketch width={326} />
        <AppText variant="note" muted style={{ position: 'absolute', left: 70, bottom: 6, fontSize: 20, transform: [{ rotate: '-2deg' }] }}>
          lay it flat, fill the frame
        </AppText>
      </Card>

      <View style={{ gap: 12 }}>
        <Button title="Take photo" icon="camera-outline" onPress={() => scan('camera')} />
        <Button title="Choose from photos" kind="secondary" onPress={() => scan('library')} />
      </View>

      {error && <Banner tone="danger">{error}</Banner>}

      <Card seed="buy-check" style={{ gap: 16, marginTop: space.sm }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <AppText variant="title">Should I buy this?</AppText>
          {!isPro && <ProTag />}
        </Row>
        <View style={{ flexDirection: 'row', gap: 18 }}>
          <View style={{ flex: 1 }}>
            <Field label="What is it?" value={item} onChangeText={setItem} placeholder="e.g. wireless earbuds" maxLength={120} />
          </View>
          <View style={{ width: 100 }}>
            <Field label="Price" value={price} onChangeText={setPrice} placeholder="0.00" keyboardType="decimal-pad" />
          </View>
        </View>
        <Button title="Check it" onPress={runCheck} loading={busy === 'check'} />
        {busy === 'check' && <ThinkingNote />}
        {check && (
          <View style={{ gap: 14 }}>
            <SketchRule seed={33} opacity={0.3} />
            <Row style={{ justifyContent: 'space-between' }}>
              <Pill label={check.necessity === 'need' ? 'A need' : 'A want'} mark={check.necessity === 'need' ? <NeedMark size={10} /> : <WantMark size={10} />} />
              <Stamp label={VERDICT[check.verdict]} />
            </Row>
            {(hours !== null || shareOfSafe !== null) && (
              <Row style={{ gap: 14, alignItems: 'flex-start' }}>
                {hours !== null && <Metric value={`${hours < 10 ? hours.toFixed(1) : Math.round(hours)} h`} label="of your work" />}
                {shareOfSafe !== null && <Metric value={`${shareOfSafe}%`} label="of what’s safe to spend" />}
              </Row>
            )}
            <AppText muted style={{ fontSize: 15, lineHeight: 22 }}>
              {check.reason}
              {check.cheaper_alternative ? <AppText style={{ fontSize: 15 }}> Cheaper: {check.cheaper_alternative}</AppText> : null}
            </AppText>
            {check.questions.length > 0 && (
              <AppText variant="note" muted style={{ fontSize: 20, lineHeight: 23 }}>
                {check.questions.slice(0, 3).join('\n')}
              </AppText>
            )}
          </View>
        )}
      </Card>

      <Card seed="review" style={{ gap: 14 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <AppText weight="semibold">{monthName} review</AppText>
            <AppText variant="caption" muted>
              A short read on your month, with three tips
            </AppText>
          </View>
          {!isPro && <ProTag />}
        </Row>
        {review && (
          <View style={{ gap: 12 }}>
            <Row style={{ gap: space.lg }}>
              <SketchCircle size={64} seed={57}>
                <AppText variant="number" style={tabular}>
                  {Math.max(0, Math.min(100, Math.round(review.safety_score)))}
                </AppText>
              </SketchCircle>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="note" muted style={{ fontSize: 18 }}>
                  safety score
                </AppText>
                <AppText variant="title" style={{ fontSize: 24, lineHeight: 28 }}>
                  {review.headline}
                </AppText>
              </View>
            </Row>
            <AppText style={{ fontSize: 15, lineHeight: 22 }}>{review.summary}</AppText>
            {review.tips.map((tip, i) => (
              <Row key={tip} style={{ alignItems: 'flex-start', gap: space.md }}>
                <AppText variant="number" style={{ fontSize: 20, lineHeight: 24, color: colors.pencil }}>
                  {i + 1}
                </AppText>
                <AppText style={{ flex: 1, fontSize: 15, lineHeight: 22 }}>{tip}</AppText>
              </Row>
            ))}
          </View>
        )}
        <Button title={review ? 'Read it again' : 'Get my review'} kind="secondary" onPress={runReview} loading={busy === 'review'} />
        {busy === 'review' && <ThinkingNote />}
      </Card>

      {scans && scans.length > 0 && (
        <View>
          <SectionTitle>Recent scans</SectionTitle>
          {scans.map((s, i) => (
            <TxRow
              key={s.id}
              tx={s}
              custom={settings.customCategories}
              showDate
              last={i === scans.length - 1}
              onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: s.id } })}
            />
          ))}
        </View>
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

      <Modal visible={busy === 'scan'} transparent animationType="fade">
        <View style={styles.busyBackdrop}>
          <Card seed="reading" style={styles.busyCard}>
            <Pulse>
              <LogoMark size={72} />
            </Pulse>
            <AppText variant="title" center>
              Reading your receipt…
            </AppText>
            <AppText muted center>
              The AI checks every line for totals, and needs vs wants. This can take up to a minute.
            </AppText>
          </Card>
        </View>
      </Modal>
    </Screen>
  );
}

function ThinkingNote() {
  return (
    <AppText variant="note" muted center style={{ fontSize: 19 }}>
      thinking it through… this can take up to a minute
    </AppText>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1 }}>
      <AppText variant="number" style={tabular}>
        {value}
      </AppText>
      <AppText variant="caption" muted style={{ marginTop: 2 }}>
        {label}
      </AppText>
    </View>
  );
}

/** Gently breathes its child while the AI works. */
function Pulse({ children }: { children: ReactNode }) {
  const [scale] = useState(() => new Animated.Value(1));
  useEffect(() => {
    const native = Platform.OS !== 'web';
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.08, duration: 800, useNativeDriver: native }),
        Animated.timing(scale, { toValue: 1, duration: 800, useNativeDriver: native }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scale]);
  return <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  busyBackdrop: { flex: 1, backgroundColor: 'rgba(17,17,17,0.35)', alignItems: 'center', justifyContent: 'center', padding: space.xl },
  busyCard: { padding: space.xl, alignItems: 'center', gap: space.md, width: '100%', maxWidth: 360 },
});

