import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Hatch, Mark } from '@/components/marks';
import { Appear, GrowX } from '@/components/motion';
import { WorkingBar } from '@/components/pictures';
import { AppText, Button, Field, haptic, Notice, Rule, Screen, TopBar } from '@/components/ui';
import type { CheckResult } from '../../shared/schemas';
import { depositsBetween, useActiveGoal } from '@/db/goals';
import { useLiveQuery } from '@/db/live';
import { listRecurring } from '@/db/recurring';
import { useSettings } from '@/db/settings';
import { listBetween } from '@/db/transactions';
import { budgetContext } from '@/lib/ai-context';
import { ApiError, checkPurchase, NeedsProError } from '@/lib/api';
import { hourlyRateCents, hoursOfWork, safeToSpend } from '@/lib/budget';
import { endOfMonth, parseISODate, startOfMonth, today } from '@/lib/dates';
import { movesBetween } from '@/lib/goal';
import { centsToInput, formatFigure, formatMoney, fromCents, parseAmount } from '@/lib/money';
import { useRequirePro } from '@/lib/pro';
import { colors } from '@/theme/tokens';

const VERDICT = { go: 'Go for it', wait: 'Sleep on it', skip: 'Probably skip' } as const;

// Answers for this session, so coming back doesn't ask the AI again.
const answers = new Map<string, CheckResult>();

export default function BuyCheck() {
  const params = useLocalSearchParams<{ item?: string; price?: string }>();
  const settings = useSettings();
  const goal = useActiveGoal();
  const requirePro = useRequirePro();
  const t = today();
  const monthStart = startOfMonth(t);
  const monthEnd = endOfMonth(t);
  const { data: txs } = useLiveQuery((d) => listBetween(d, monthStart, monthEnd), [monthStart, monthEnd]);
  const { data: recurring } = useLiveQuery(listRecurring, []);
  const { data: deposits } = useLiveQuery((d) => depositsBetween(d, monthStart, monthEnd), [monthStart, monthEnd]);

  const [item, setItem] = useState(params.item ?? '');
  const [price, setPrice] = useState(params.price ? centsToInput(Number(params.price)) : '');
  const [asked, setAsked] = useState<{ item: string; cents: number } | null>(null);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const ready = !!(txs && recurring && deposits && settings && goal !== undefined);
  const safe =
    ready && settings
      ? safeToSpend({
          today: t,
          txs: txs ?? [],
          expectedIncomeCents: settings.monthlyIncomeCents,
          savingsGoalCents: settings.savingsGoalCents,
          recurring: recurring ?? [],
          savingsMoves: movesBetween(deposits ?? [], monthStart, monthEnd),
        })
      : null;

  const run = async () => {
    if (!settings || !safe) return;
    setError(null);
    const cents = parseAmount(price);
    if (!item.trim() || !cents || cents <= 0) {
      haptic('warning');
      return setError('Write what you want to buy and its price.');
    }
    const key = `${item.trim().toLowerCase()}|${cents}|${t.slice(0, 7)}`;
    setAsked({ item: item.trim(), cents });
    const cached = answers.get(key);
    if (cached) return setResult(cached);
    setResult(null);
    setBusy(true);
    try {
      const budget = budgetContext({
        safe,
        txs: txs ?? [],
        today: t,
        settings,
        goal: goal ? { name: goal.goal.name, target_cents: goal.goal.target_cents, saved: goal.saved } : null,
      });
      const answer = await checkPurchase({ item: item.trim(), price: fromCents(cents), currency: settings.currency, budget });
      answers.set(key, answer);
      haptic('success');
      setResult(answer);
    } catch (e) {
      haptic('warning');
      if (e instanceof NeedsProError) requirePro('ai_check');
      else setError(e instanceof ApiError || e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  // Ask as soon as the numbers for this month are in.
  useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when ready
  }, [ready]);

  const currency = settings?.currency ?? 'USD';
  const hourly = settings ? hourlyRateCents(settings.monthlyIncomeCents, settings.hoursPerWeek) : null;
  const hours = asked ? hoursOfWork(asked.cents, hourly) : null;
  const room = safe && safe.status !== 'unset' ? Math.max(0, safe.amount) : null;
  const share = asked && room ? Math.round((asked.cents / room) * 100) : null;
  const month = parseISODate(t).toLocaleDateString(undefined, { month: 'long' });

  return (
    <Screen>
      <TopBar onBack={() => router.back()} />
      <AppText variant="headline" accessibilityRole="header" style={{ marginTop: 24 }}>
        Should I buy this?
      </AppText>
      <View style={styles.fields}>
        <View style={{ flex: 1 }}>
          <Field label="What is it?" value={item} onChangeText={setItem} maxLength={120} />
        </View>
        <View style={{ width: 100 }}>
          <Field label="Price" value={price} onChangeText={setPrice} keyboardType="decimal-pad" inputMode="decimal" />
        </View>
      </View>
      <Button title={result || error ? 'Check again' : 'Check it'} kind="secondary" onPress={run} loading={busy} style={{ marginTop: 20 }} />

      <Rule />

      {busy && (
        <Appear>
          <AppText variant="caption" muted>
            Answer
          </AppText>
          <AppText weight="light" style={styles.verdict}>
            Thinking it through
          </AppText>
          <WorkingBar style={{ marginTop: 20 }} />
          <AppText variant="caption" muted style={{ marginTop: 10 }}>
            Weighed against {month}: what’s safe to spend, your pay and your savings. This can take up to a minute.
          </AppText>
        </Appear>
      )}

      {error && !busy && <Notice tone="alert">{error}</Notice>}

      {result && asked && !busy && (
        <View accessibilityLiveRegion="polite">
          <Appear>
            <AppText variant="caption" muted>
              Answer
            </AppText>
            <View style={styles.answerRow}>
              <AppText weight="light" style={[styles.verdict, { flex: 1 }]} accessibilityRole="header">
                {VERDICT[result.verdict]}
              </AppText>
              <View style={styles.tag}>
                <Mark kind={result.necessity} size={8} />
                <AppText variant="caption">{result.necessity === 'need' ? 'A need' : 'A want'}</AppText>
              </View>
            </View>
          </Appear>

          <Appear delay={80} style={styles.stats}>
            {hours !== null && (
              <Figure value={<>{hours < 10 ? hours.toFixed(1) : Math.round(hours)} h</>} label={<>of your work</>} />
            )}
            {share !== null && (
              <Figure value={<>{share}%</>} label={<>of what’s safe to spend</>} />
            )}
            {room !== null && (
              <Figure value={<>{formatMoney(room - asked.cents, currency, { compact: true })}</>} label={<>{room - asked.cents >= 0 ? 'left after it' : 'over what’s safe'}</>} />
            )}
          </Appear>

          {room !== null && room > 0 && (
            <Appear delay={140} style={{ marginTop: 28 }}>
              <View aria-hidden style={{ height: 22 }}>
                <AppText variant="axis" muted style={{ position: 'absolute', left: 0, top: 0 }}>
                  {formatFigure(asked.cents, currency)}
                </AppText>
                <AppText variant="axis" muted style={{ position: 'absolute', right: 0, top: 0 }}>
                  {formatFigure(room, currency)} safe to spend
                </AppText>
                <View style={[styles.tick, { left: 0 }]} />
                <View style={[styles.tick, { left: `${Math.min(100, (asked.cents / room) * 100)}%` }]} />
                <View style={[styles.tick, { right: 0 }]} />
              </View>
              <View
                accessible
                accessibilityRole="image"
                accessibilityLabel={`${formatMoney(asked.cents, currency)} is ${share}% of the ${formatMoney(room, currency)} safe to spend`}
                style={styles.bar}>
                <GrowX
                  delay={200}
                  style={{ width: `${Math.min(100, (asked.cents / room) * 100)}%`, backgroundColor: result.necessity === 'need' ? colors.ink : colors.page, overflow: 'hidden' }}>
                  {result.necessity === 'want' && <Hatch />}
                </GrowX>
              </View>
            </Appear>
          )}

          <Appear delay={200}>
            <AppText style={{ marginTop: 28 }}>{result.reason}</AppText>
            {result.cheaper_alternative && (
              <AppText style={{ marginTop: 12 }}>
                <AppText muted>Cheaper: </AppText>
                {result.cheaper_alternative}
              </AppText>
            )}
            {result.questions.length > 0 && (
              <View style={styles.questions}>
                {result.questions.slice(0, 3).map((q, i) => (
                  <View key={q} style={styles.question}>
                    <AppText variant="monoSmall" muted style={{ width: 28, lineHeight: 22 }}>
                      {i + 1}
                    </AppText>
                    <AppText style={{ flex: 1 }}>{q}</AppText>
                  </View>
                ))}
              </View>
            )}
            <AppText variant="small" muted style={{ marginTop: 24 }}>
              Written by AI from this item, its price and a few numbers about {month}. A suggestion, not financial advice.
            </AppText>
          </Appear>
        </View>
      )}
    </Screen>
  );
}

/** A light number with a quiet line under it. */
function Figure({ value, label }: { value: ReactNode; label: ReactNode }) {
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <AppText variant="number">{value}</AppText>
      <AppText variant="small" muted style={{ marginTop: 2 }}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  fields: { flexDirection: 'row', gap: 20, marginTop: 24 },
  verdict: { fontSize: 48, lineHeight: 52, letterSpacing: -1.92, marginTop: 4 },
  answerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 30, paddingHorizontal: 10, borderWidth: 1, borderColor: colors.ink, marginBottom: 8 },
  stats: { flexDirection: 'row', gap: 16, marginTop: 28 },
  tick: { position: 'absolute', bottom: 0, width: 1, height: 6, backgroundColor: colors.ink },
  bar: { flexDirection: 'row', height: 12, borderWidth: 1, borderColor: colors.ink, backgroundColor: colors.page, overflow: 'hidden' },
  questions: { marginTop: 28, borderTopWidth: 1, borderTopColor: colors.rule },
  question: { flexDirection: 'row', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.line },
});
