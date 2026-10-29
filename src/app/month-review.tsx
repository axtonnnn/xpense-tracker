import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Appear, GrowX, useCountUp } from '@/components/motion';
import { WorkingBar } from '@/components/pictures';
import { AppText, Button, haptic, Notice, Screen, TopBar } from '@/components/ui';
import type { ReviewResult } from '../../shared/schemas';
import { useActiveGoal } from '@/db/goals';
import { useLiveQuery } from '@/db/live';
import { useSettings } from '@/db/settings';
import { listBetween } from '@/db/transactions';
import { reviewRequest } from '@/lib/ai-context';
import { ApiError, monthlyReview, NeedsProError } from '@/lib/api';
import { pctChange, totals } from '@/lib/budget';
import { addMonths, endOfMonth, parseISODate, startOfMonth, today } from '@/lib/dates';
import { formatFigure } from '@/lib/money';
import { useRequirePro } from '@/lib/pro';
import { colors } from '@/theme/tokens';

// One review per month per session: coming back shows it again without asking the AI twice.
const reviews = new Map<string, ReviewResult>();

export default function MonthReview() {
  const settings = useSettings();
  const goal = useActiveGoal();
  const requirePro = useRequirePro();
  const t = today();
  const monthStart = startOfMonth(t);
  const prevStart = addMonths(monthStart, -1, 1);
  const { data: txs } = useLiveQuery((d) => listBetween(d, prevStart, endOfMonth(t)), [prevStart, t]);
  const key = t.slice(0, 7);
  const [result, setResult] = useState<ReviewResult | null>(reviews.get(key) ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  const ready = !!(txs && settings && goal !== undefined);

  const run = async () => {
    if (!txs || !settings) return;
    setError(null);
    setBusy(true);
    try {
      const answer = await monthlyReview(
        reviewRequest({ txs, today: t, settings, goal: goal ? { name: goal.goal.name, target_cents: goal.goal.target_cents, saved: goal.saved } : null }),
      );
      reviews.set(key, answer);
      haptic('success');
      setResult(answer);
    } catch (e) {
      haptic('warning');
      if (e instanceof NeedsProError) requirePro('ai_review');
      else setError(e instanceof ApiError || e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!ready || started.current || result) return;
    started.current = true;
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when ready
  }, [ready]);

  const month = parseISODate(t).toLocaleDateString(undefined, { month: 'long' });
  const prevName = parseISODate(prevStart).toLocaleDateString(undefined, { month: 'short' });
  const cur = txs ? totals(txs, monthStart, endOfMonth(t)) : null;
  const prev = txs ? totals(txs, prevStart, endOfMonth(prevStart)) : null;
  const income = cur && settings ? Math.max(cur.income, settings.monthlyIncomeCents) : 0;
  const kept = cur ? income - cur.spent : 0;
  const currency = settings?.currency ?? 'USD';
  const delta = (now: number, before: number) => {
    const p = pctChange(now, before);
    return p === null ? null : `${p > 0 ? '+' : p < 0 ? '−' : '±'}${Math.abs(p)}% vs ${prevName}`;
  };

  return (
    <Screen>
      <TopBar onBack={() => router.back()} />
      <AppText variant="caption" muted style={{ marginTop: 24 }}>
        {month} review
      </AppText>

      {busy && !result && (
        <Appear>
          <AppText variant="headline" accessibilityRole="header" style={{ marginTop: 4 }}>
            Reading your month
          </AppText>
          <WorkingBar style={{ marginTop: 28 }} />
          <AppText variant="caption" muted style={{ marginTop: 10 }}>
            Only this month’s totals go to the AI: no entries, shops or notes. This can take up to a minute.
          </AppText>
        </Appear>
      )}

      {error && !busy && (
        <View style={{ marginTop: 16 }}>
          <Notice tone="alert">{error}</Notice>
          <Button title="Try again" onPress={run} style={{ marginTop: 20 }} />
        </View>
      )}

      {result && cur && prev && (
        <View>
          <Appear>
            <AppText variant="headline" accessibilityRole="header" style={{ marginTop: 4 }}>
              {result.headline}
            </AppText>
          </Appear>
          <Score score={result.safety_score} />
          <Appear delay={160}>
            <AppText style={{ marginTop: 28 }}>{result.summary}</AppText>
            <View style={styles.stats}>
              <Figure label="Needs" value={formatFigure(cur.need, currency)} note={delta(cur.need, prev.need)} />
              <Figure label="Wants" value={formatFigure(cur.want, currency)} note={delta(cur.want, prev.want)} />
              <Figure label="Kept" value={formatFigure(kept, currency)} note={income > 0 ? `${Math.round((kept / income) * 100)}% of pay` : null} />
            </View>
          </Appear>
          <Appear delay={240}>
            <AppText variant="title" accessibilityRole="header" style={{ marginTop: 36 }}>
              Three tips
            </AppText>
            <View style={styles.tips}>
              {result.tips.slice(0, 3).map((tip, i) => (
                <View key={tip} style={styles.tip}>
                  <AppText variant="monoSmall" muted style={{ width: 36, lineHeight: 22 }}>
                    {String(i + 1).padStart(2, '0')}
                  </AppText>
                  <AppText style={{ flex: 1 }}>{tip}</AppText>
                </View>
              ))}
            </View>
            <AppText variant="small" muted style={{ marginTop: 24, lineHeight: 17 }}>
              Written by AI from this month’s totals. No entries, shops or notes were sent. Suggestions, not financial advice.
            </AppText>
          </Appear>
        </View>
      )}
    </Screen>
  );
}

/** The safety score: a big number that counts up, over a bar that fills to it. */
function Score({ score }: { score: number }) {
  const value = Math.max(0, Math.min(100, Math.round(score)));
  const shown = useCountUp(value * 100) / 100;
  return (
    <View>
      <View style={styles.scoreRow} accessible accessibilityLabel={`Safety score ${value} out of 100`}>
        <AppText variant="hero">{Math.round(shown)}</AppText>
        <AppText muted>
          out of 100{'\n'}safety score
        </AppText>
      </View>
      <View aria-hidden style={styles.bar}>
        <GrowX delay={100} style={{ width: `${value}%`, backgroundColor: colors.ink }} />
      </View>
      <View aria-hidden style={styles.ticks}>
        {[0, 25, 50, 75, 100].map((n) => (
          <AppText key={n} variant="axis" muted>
            {n}
          </AppText>
        ))}
      </View>
    </View>
  );
}

function Figure({ label, value, note }: { label: string; value: string; note: string | null }) {
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <AppText variant="small" muted>
        {label}
      </AppText>
      <AppText weight="light" numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 22, lineHeight: 28, letterSpacing: -0.66, marginTop: 4 }}>
        {value}
      </AppText>
      {note && (
        <AppText variant="index" muted style={{ marginTop: 2 }}>
          {note}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 28 },
  bar: { flexDirection: 'row', height: 12, marginTop: 16, borderWidth: 1, borderColor: colors.ink, backgroundColor: colors.page, overflow: 'hidden' },
  ticks: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  stats: { flexDirection: 'row', gap: 16, marginTop: 28, paddingTop: 20, borderTopWidth: 1, borderTopColor: colors.rule },
  tips: { marginTop: 12, borderTopWidth: 1, borderTopColor: colors.rule },
  tip: { flexDirection: 'row', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.line },
});
