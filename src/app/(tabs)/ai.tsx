import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ConsentSheet } from '@/components/ConsentSheet';
import { AppText, Banner, Button, Card, Field, ProBadge, Row, Screen, SectionTitle } from '@/components/ui';
import type { CheckResult, ReviewResult } from '../../../shared/schemas';
import { useLiveQuery } from '@/db/live';
import { listRecurring } from '@/db/recurring';
import { setSettings, useSettings } from '@/db/settings';
import { listBetween, listRecentScans } from '@/db/transactions';
import { ApiError, checkPurchase, monthlyReview, NeedsProError } from '@/lib/api';
import { categoryBreakdown, hourlyRateCents, hoursOfWork, safeToSpend, totals } from '@/lib/budget';
import { FREE_TRIAL_SCANS } from '@/lib/config';
import { addMonths, endOfMonth, formatDay, monthKey, startOfMonth, today } from '@/lib/dates';
import { formatMoney, fromCents, parseAmount } from '@/lib/money';
import { usePro, useRequirePro } from '@/lib/pro';
import { pickImage, runScan, type PickSource } from '@/lib/scan';
import { radius, space, useColors } from '@/theme/tokens';

const VERDICT = {
  go: { label: 'Reasonable buy', icon: 'checkmark-circle' as const },
  wait: { label: 'Sleep on it', icon: 'time' as const },
  skip: { label: 'Probably skip', icon: 'close-circle' as const },
};

export default function AIMode() {
  const db = useSQLiteContext();
  const c = useColors();
  const settings = useSettings();
  const { isPro } = usePro();
  const requirePro = useRequirePro();
  const t = today();
  const monthStart = startOfMonth(t);
  const prevStart = addMonths(monthStart, -1, 1);
  const { data: txs } = useLiveQuery((d) => listBetween(d, prevStart, endOfMonth(t)), [prevStart, t]);
  const { data: recurring } = useLiveQuery(listRecurring, []);
  const { data: scans } = useLiveQuery((d) => listRecentScans(d, 8), []);

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

  const runCheck = () => {
    setError(null);
    const cents = parseAmount(price);
    if (!item.trim() || !cents || cents <= 0) {
      setError('Enter what you want to buy and its price.');
      return;
    }
    if (!requirePro('ai_check')) return;
    withConsent(async () => {
      setBusy('check');
      try {
        const result = await checkPurchase({ item: item.trim(), price: fromCents(cents), currency });
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

  const hourly = hourlyRateCents(settings.monthlyIncomeCents, settings.hoursPerWeek);
  const safe =
    txs && recurring
      ? safeToSpend({
          today: t,
          txs,
          expectedIncomeCents: settings.monthlyIncomeCents,
          savingsGoalCents: settings.savingsGoalCents,
          recurring,
        })
      : null;

  return (
    <Screen>
      <Card style={{ gap: space.lg }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={[styles.heroIcon, { backgroundColor: c.surfaceAlt }]}>
            <Ionicons name="scan" size={26} color={c.primary} />
          </View>
          {isPro ? (
            <ProBadge />
          ) : (
            <AppText variant="caption" muted>
              {trialLeft > 0 ? `${trialLeft} free ${trialLeft === 1 ? 'scan' : 'scans'} left` : 'Free scans used'}
            </AppText>
          )}
        </Row>
        <View style={{ gap: 4 }}>
          <AppText variant="title">Scan a receipt or bill</AppText>
          <AppText muted>AI reads the items, totals and date, and sorts each line into needs and wants for you.</AppText>
        </View>
        <Button title="Take photo" icon="camera" onPress={() => scan('camera')} />
        <Button title="Choose from photos" icon="images-outline" kind="secondary" onPress={() => scan('library')} />
      </Card>

      {error && <Banner tone="danger">{error}</Banner>}

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <AppText variant="title">Should I buy this?</AppText>
          {!isPro && <ProBadge />}
        </Row>
        <AppText muted>Pause before a purchase. See it in hours of work and get an honest second opinion.</AppText>
        <Field value={item} onChangeText={setItem} placeholder="What is it? e.g. wireless earbuds" maxLength={120} />
        <Field value={price} onChangeText={setPrice} placeholder={`Price (${currency})`} keyboardType="decimal-pad" />
        <Button title="Check it" icon="help-circle-outline" onPress={runCheck} loading={busy === 'check'} />
        {check && (
          <View style={{ gap: space.sm }}>
            <Row>
              <Ionicons name={VERDICT[check.verdict].icon} size={22} color={check.verdict === 'go' ? c.need : c.want} />
              <AppText variant="title">{VERDICT[check.verdict].label}</AppText>
              <AppText muted>· {check.necessity === 'need' ? 'Need' : 'Want'}</AppText>
            </Row>
            {hoursOfWork(check.priceCents, hourly) !== null && (
              <AppText>
                ≈ <AppText style={{ fontWeight: '700' }}>{hoursOfWork(check.priceCents, hourly)!.toFixed(1)} hours</AppText> of
                work
              </AppText>
            )}
            {safe && safe.amount > 0 && (
              <AppText>
                {Math.round((check.priceCents / safe.amount) * 100)}% of what’s safe to spend this month
              </AppText>
            )}
            <AppText muted>{check.reason}</AppText>
            {check.cheaper_alternative && (
              <Row style={{ alignItems: 'flex-start' }}>
                <Ionicons name="leaf-outline" size={16} color={c.need} style={{ marginTop: 3 }} />
                <AppText style={{ flex: 1 }}>{check.cheaper_alternative}</AppText>
              </Row>
            )}
            {check.questions.slice(0, 3).map((q) => (
              <AppText key={q} variant="caption" muted>
                • {q}
              </AppText>
            ))}
          </View>
        )}
      </Card>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <AppText variant="title">Monthly review</AppText>
          {!isPro && <ProBadge />}
        </Row>
        <AppText muted>A short, plain-language look at this month’s needs and wants, with three tips.</AppText>
        {review ? (
          <View style={{ gap: space.sm }}>
            <AppText style={{ fontWeight: '700' }}>{review.headline}</AppText>
            <View style={{ gap: 6 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <AppText variant="caption" muted>
                  Safety score
                </AppText>
                <AppText variant="caption" style={{ fontWeight: '700' }}>
                  {Math.round(review.safety_score)}/100
                </AppText>
              </Row>
              <View style={{ height: 8, borderRadius: 4, backgroundColor: c.surfaceAlt }}>
                <View
                  style={{
                    height: 8,
                    borderRadius: 4,
                    width: `${Math.max(0, Math.min(100, review.safety_score))}%`,
                    backgroundColor: review.safety_score >= 60 ? c.need : c.want,
                  }}
                />
              </View>
            </View>
            <AppText>{review.summary}</AppText>
            {review.tips.map((tip) => (
              <Row key={tip} style={{ alignItems: 'flex-start' }}>
                <Ionicons name="leaf-outline" size={16} color={c.need} style={{ marginTop: 3 }} />
                <AppText style={{ flex: 1 }}>{tip}</AppText>
              </Row>
            ))}
          </View>
        ) : null}
        <Button
          title={review ? 'Refresh review' : 'Get my review'}
          icon="sparkles-outline"
          kind="secondary"
          onPress={runReview}
          loading={busy === 'review'}
        />
      </Card>

      {scans && scans.length > 0 && (
        <>
          <SectionTitle>Recent scans</SectionTitle>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md }}>
            {scans.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: s.id } })}
                style={[styles.scanCard, { backgroundColor: c.surface, borderColor: c.border }]}>
                {s.image_uri ? (
                  <Image source={{ uri: s.image_uri }} style={styles.thumb} contentFit="cover" />
                ) : (
                  <View style={[styles.thumb, { backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }]}>
                    <Ionicons name="receipt-outline" size={24} color={c.inkMuted} />
                  </View>
                )}
                <AppText numberOfLines={1}>{s.merchant ?? 'Receipt'}</AppText>
                <AppText variant="caption" muted>
                  {formatMoney(s.amount_cents, s.currency)} · {formatDay(s.occurred_on, { month: 'short', day: 'numeric' })}
                </AppText>
              </Pressable>
            ))}
          </ScrollView>
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

      <Modal visible={busy === 'scan'} transparent animationType="fade">
        <View style={styles.busyBackdrop}>
          <View style={[styles.busyCard, { backgroundColor: c.surface }]}>
            <ActivityIndicator size="large" color={c.primary} />
            <AppText variant="title">Reading your receipt…</AppText>
            <AppText muted style={{ textAlign: 'center' }}>
              Finding items, totals and what’s a need or a want.
            </AppText>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  scanCard: { width: 150, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: space.sm, gap: 4 },
  thumb: { width: '100%', height: 110, borderRadius: radius.sm },
  busyBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', padding: space.xl },
  busyCard: { borderRadius: radius.md, padding: space.xl, alignItems: 'center', gap: space.md, width: '100%', maxWidth: 360 },
});
