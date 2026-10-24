import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { LogoMark } from '@/components/brand';
import { ConsentSheet } from '@/components/ConsentSheet';
import { ReceiptScan } from '@/components/illustrations';
import { AppText, Banner, Button, Card, Field, HeroCard, IconCircle, Pill, ProBadge, Row, Screen, SectionTitle } from '@/components/ui';
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
import { elevation, fonts, radius, space, useColors, useIsDark } from '@/theme/tokens';

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
      ? safeToSpend({ today: t, txs, expectedIncomeCents: settings.monthlyIncomeCents, savingsGoalCents: settings.savingsGoalCents, recurring })
      : null;
  const hours = check ? hoursOfWork(check.priceCents, hourly) : null;

  return (
    <Screen>
      <HeroCard>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <ReceiptScan width={118} onHero />
          {isPro ? (
            <ProBadge onHero />
          ) : (
            <Pill
              icon="sparkles"
              label={trialLeft > 0 ? `${trialLeft} free ${trialLeft === 1 ? 'scan' : 'scans'} left` : 'Free scans used'}
              color={c.onHero}
              bg="rgba(246,244,238,0.14)"
            />
          )}
        </Row>
        <View style={{ gap: 4 }}>
          <AppText variant="display" color={c.onHero} style={{ fontSize: 26, lineHeight: 32 }}>
            Scan a receipt or bill
          </AppText>
          <AppText color={c.onHeroMuted}>AI reads every item, total and date, and sorts each line into needs and wants.</AppText>
        </View>
        <Button title="Take photo" icon="camera" kind="hero" onPress={() => scan('camera')} />
        <Button title="Choose from photos" icon="images-outline" kind="heroGhost" onPress={() => scan('library')} />
      </HeroCard>

      {error && <Banner tone="danger">{error}</Banner>}

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row style={{ gap: space.md }}>
            <IconCircle icon="bag-handle-outline" bg={c.wantSoft} color={c.wantInk} />
            <AppText variant="title">Should I buy this?</AppText>
          </Row>
          {!isPro && <ProBadge />}
        </Row>
        <AppText muted>Pause before a purchase. See it in hours of work and get an honest second opinion.</AppText>
        <Field icon="pricetag-outline" value={item} onChangeText={setItem} placeholder="What is it? e.g. wireless earbuds" maxLength={120} />
        <Field icon="cash-outline" value={price} onChangeText={setPrice} placeholder={`Price (${currency})`} keyboardType="decimal-pad" />
        <Button title="Check it" icon="help-circle-outline" onPress={runCheck} loading={busy === 'check'} />
        {busy === 'check' && <ThinkingNote />}
        {check && (
          <View style={{ gap: space.md }}>
            <Row style={{ flexWrap: 'wrap' }}>
              <Verdict verdict={check.verdict} />
              <Pill
                label={check.necessity === 'need' ? 'Need' : 'Want'}
                icon={check.necessity === 'need' ? 'shield-checkmark' : 'star'}
                color={check.necessity === 'need' ? c.needInk : c.wantInk}
                bg={check.necessity === 'need' ? c.needSoft : c.wantSoft}
              />
            </Row>
            <Row style={{ gap: space.md }}>
              {hours !== null && <Metric value={`${hours.toFixed(1)} h`} label="of your work" />}
              {safe && safe.amount > 0 && <Metric value={`${Math.round((check.priceCents / safe.amount) * 100)}%`} label="of safe-to-spend" />}
            </Row>
            <AppText>{check.reason}</AppText>
            {check.cheaper_alternative && (
              <Row style={{ alignItems: 'flex-start', gap: space.md }}>
                <Ionicons name="leaf" size={18} color={c.need} style={{ marginTop: 2 }} />
                <AppText weight="semibold" style={{ flex: 1 }}>
                  {check.cheaper_alternative}
                </AppText>
              </Row>
            )}
            {check.questions.slice(0, 3).map((q) => (
              <Row key={q} style={{ alignItems: 'flex-start', gap: space.sm }}>
                <AppText muted>•</AppText>
                <AppText muted style={{ flex: 1 }}>
                  {q}
                </AppText>
              </Row>
            ))}
          </View>
        )}
      </Card>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row style={{ gap: space.md }}>
            <IconCircle icon="sparkles-outline" />
            <AppText variant="title">Monthly review</AppText>
          </Row>
          {!isPro && <ProBadge />}
        </Row>
        <AppText muted>A short, plain-language look at this month’s needs and wants, with three tips.</AppText>
        {review && (
          <View style={{ gap: space.md }}>
            <Row style={{ gap: space.lg }}>
              <ScoreRing score={review.safety_score} />
              <View style={{ flex: 1, gap: 4 }}>
                <AppText variant="label" muted>
                  Safety score
                </AppText>
                <AppText variant="title">{review.headline}</AppText>
              </View>
            </Row>
            <AppText>{review.summary}</AppText>
            {review.tips.map((tip) => (
              <Row key={tip} style={{ alignItems: 'flex-start', gap: space.md }}>
                <Ionicons name="leaf" size={16} color={c.need} style={{ marginTop: 3 }} />
                <AppText style={{ flex: 1 }}>{tip}</AppText>
              </Row>
            ))}
          </View>
        )}
        <Button
          title={review ? 'Refresh review' : 'Get my review'}
          icon="sparkles-outline"
          kind="secondary"
          onPress={runReview}
          loading={busy === 'review'}
        />
        {busy === 'review' && <ThinkingNote />}
      </Card>

      {scans && scans.length > 0 && (
        <>
          <SectionTitle>Recent scans</SectionTitle>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md, paddingBottom: 6 }}>
            {scans.map((s) => (
              <ScanCard
                key={s.id}
                uri={s.image_uri}
                title={s.merchant ?? 'Receipt'}
                subtitle={`${formatMoney(s.amount_cents, s.currency)} · ${formatDay(s.occurred_on, { month: 'short', day: 'numeric' })}`}
                onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: s.id } })}
              />
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
            <Pulse>
              <LogoMark size={72} />
            </Pulse>
            <AppText variant="title" center>
              Reading your receipt…
            </AppText>
            <AppText muted center>
              The AI checks every line for totals and needs vs wants. This can take up to a minute.
            </AppText>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function ThinkingNote() {
  return (
    <AppText variant="caption" muted center>
      Thinking it through carefully. This can take up to a minute.
    </AppText>
  );
}

function Verdict({ verdict }: { verdict: CheckResult['verdict'] }) {
  const c = useColors();
  const v = {
    go: { label: 'Reasonable buy', icon: 'checkmark-circle' as const, fg: c.needInk, bg: c.needSoft },
    wait: { label: 'Sleep on it', icon: 'moon' as const, fg: c.wantInk, bg: c.wantSoft },
    skip: { label: 'Probably skip', icon: 'close-circle' as const, fg: c.danger, bg: c.dangerSoft },
  }[verdict];
  return <Pill icon={v.icon} label={v.label} color={v.fg} bg={v.bg} />;
}

function Metric({ value, label }: { value: string; label: string }) {
  const c = useColors();
  return (
    <View style={[styles.metric, { backgroundColor: c.surfaceAlt }]}>
      <AppText variant="title" weight="extrabold">
        {value}
      </AppText>
      <AppText variant="caption" muted>
        {label}
      </AppText>
    </View>
  );
}

/** Safety score as a ring: evergreen when strong, amber in the middle, red when low. */
function ScoreRing({ score, size = 76 }: { score: number; size?: number }) {
  const c = useColors();
  const value = Math.max(0, Math.min(100, Math.round(score)));
  const stroke = 8;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const color = value >= 60 ? c.need : value >= 40 ? c.want : c.danger;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel={`Safety score ${value} out of 100`}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.surfaceAlt} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${(circ * value) / 100} ${circ}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <AppText style={{ fontFamily: fonts.extrabold, fontSize: 22, lineHeight: 26 }}>{value}</AppText>
    </View>
  );
}

function ScanCard({ uri, title, subtitle, onPress }: { uri: string | null; title: string; subtitle: string; onPress: () => void }) {
  const c = useColors();
  const dark = useIsDark();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.scanCard,
        { backgroundColor: c.surface, opacity: pressed ? 0.8 : 1 },
        dark ? { borderWidth: StyleSheet.hairlineWidth, borderColor: c.border } : elevation(false),
      ]}>
      {uri ? (
        <Image source={{ uri }} style={styles.thumb} contentFit="cover" />
      ) : (
        <View style={[styles.thumb, { backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }]}>
          <Ionicons name="receipt-outline" size={26} color={c.inkMuted} />
        </View>
      )}
      <AppText weight="semibold" numberOfLines={1}>
        {title}
      </AppText>
      <AppText variant="caption" muted>
        {subtitle}
      </AppText>
    </Pressable>
  );
}

/** Gently breathes its child while the AI works. */
function Pulse({ children }: { children: ReactNode }) {
  const [scale] = useState(() => new Animated.Value(1));
  useEffect(() => {
    const native = Platform.OS !== 'web';
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.1, duration: 700, useNativeDriver: native }),
        Animated.timing(scale, { toValue: 1, duration: 700, useNativeDriver: native }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scale]);
  return <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  metric: { flex: 1, borderRadius: radius.md, padding: space.md, gap: 2 },
  scanCard: { width: 156, borderRadius: radius.md, padding: space.sm, gap: 4 },
  thumb: { width: '100%', height: 112, borderRadius: radius.sm, marginBottom: 4 },
  busyBackdrop: { flex: 1, backgroundColor: 'rgba(10,20,17,0.45)', alignItems: 'center', justifyContent: 'center', padding: space.xl },
  busyCard: { borderRadius: radius.lg, padding: space.xl, alignItems: 'center', gap: space.md, width: '100%', maxWidth: 360 },
});
