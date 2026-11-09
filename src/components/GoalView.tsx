import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { StyleSheet, View } from 'react-native';

import { goalWords, MoneySheet, projection, useMoneySheet } from './goal-ui';
import { Appear, useEntrance } from './motion';
import { CountUp, GoalBar, MoneyRow } from './money-ui';
import { EmptyPage } from './pictures';
import { useConfirm } from './Sheet';
import { useToast } from './Toast';
import { AppText, Button, EmptyState, Rule, Screen, SectionHeader, TextLink, TopBar } from './ui';
import { deleteDeposit, finishGoal, useActiveGoal, type GoalDeposit } from '@/db/goals';
import { useSettings } from '@/db/settings';
import { endOfMonth, formatDay, startOfMonth, today } from '@/lib/dates';
import { arrivalMonth, monthName, monthsBetween, movesBetween } from '@/lib/goal';
import { formatFigure, formatMoney } from '@/lib/money';

/** The savings goal: its own screen on phones, a sidebar page on iPad and Mac (`embedded`). */
export default function GoalView({ embedded }: { embedded?: boolean }) {
  const db = useSQLiteContext();
  const toast = useToast();
  const settings = useSettings();
  const state = useActiveGoal();
  const money = useMoneySheet();
  const entrance = useEntrance();
  const [dialog, ask] = useConfirm();
  const t = today();

  if (state === undefined || !settings) return <Screen>{null}</Screen>;

  if (state === null) {
    return (
      <Screen>
        {!embedded && <TopBar onBack={() => router.back()} />}
        <EmptyState
          picture={<EmptyPage />}
          title="No savings goal yet"
          body="Add what you’re saving for and what it costs. Xpense keeps track of how close you are."
          action={
            <Button
              title="Start a goal"
              onPress={() => {
                const to = { pathname: '/goal/edit' as const, params: { new: '1' } };
                if (embedded) router.push(to);
                else router.replace(to);
              }}
            />
          }
        />
      </Screen>
    );
  }

  const { goal, saved, deposits } = state;
  const currency = settings.currency;
  const setAside = settings.savingsGoalCents;
  const words = goalWords(goal.name);
  const reached = saved >= goal.target_cents;
  const thisMonth = movesBetween(deposits, startOfMonth(t), endOfMonth(t)).deposits;
  const arrival = arrivalMonth({ today: t, target: goal.target_cents, saved, setAside, depositedThisMonth: thisMonth });
  const months = monthsBetween(goal.started_on, t);
  const edit = <TextLink label="Edit" onPress={() => router.push('/goal/edit')} />;

  const bought = async () => {
    await finishGoal(db, goal.id, 'bought', t);
    toast({ message: `Enjoy ${words.saving}. Paid from your savings.` });
    if (!embedded) router.back();
  };

  const remove = async (d: GoalDeposit) => {
    const when = formatDay(d.occurred_on, { day: 'numeric', month: 'long' });
    const out = d.kind === 'withdrawal';
    const body = out
      ? `${formatMoney(d.amount_cents, currency)} taken out on ${when} will count as saved again.`
      : `${formatMoney(d.amount_cents, currency)} from ${when} comes off the goal, on all your devices.`;
    if (await ask(out ? 'Put this back?' : 'Remove this?', body, out ? 'Put it back' : 'Remove')) await deleteDeposit(db, d.id);
  };

  return (
    <Screen>
      {embedded ? <View style={{ alignItems: 'flex-end', minHeight: 44, justifyContent: 'center' }}>{edit}</View> : <TopBar onBack={() => router.back()} right={edit} />}
      <Appear>
        <AppText variant="caption" muted style={{ marginTop: 24 }}>
          Saving for
        </AppText>
        <AppText variant="display" accessibilityRole="header" style={{ marginTop: 4 }}>
          {goal.name.charAt(0).toUpperCase() + goal.name.slice(1)}
        </AppText>
        <View style={styles.amountRow}>
          <CountUp variant="hero" cents={saved} format={(c) => formatMoney(c, currency, { compact: true })} />
          {!reached && <AppText muted style={{ fontSize: 17 }}>of {formatMoney(goal.target_cents, currency, { compact: true })}</AppText>}
        </View>
      </Appear>

      <View style={{ marginTop: 28 }}>
        <GoalBar
          saved={saved}
          target={goal.target_cents}
          currency={currency}
          height={16}
          showPct
          scale={
            reached
              ? [
                  formatDay(goal.started_on, { day: 'numeric', month: 'short' }),
                  `${months} ${months === 1 ? 'month' : 'months'}`,
                  formatDay(t, { day: 'numeric', month: 'short' }),
                ]
              : undefined
          }
        />
      </View>

      {reached ? (
        <Appear delay={300}>
          <AppText variant="headline" accessibilityRole="header" style={{ marginTop: 44 }}>
            You did it.
          </AppText>
          <AppText muted style={{ marginTop: 12 }}>
            {months === 1 ? 'A month' : `${months} months`} of setting money aside. When you buy {words.saving}, tap below: it’s paid from your savings, so what’s
            safe to spend stays the same.
          </AppText>
          <Button title="I bought it" onPress={bought} style={{ marginTop: 32 }} />
          <Button title="Start a new goal" kind="secondary" onPress={() => router.push({ pathname: '/goal/edit', params: { new: '1' } })} style={{ marginTop: 10 }} />
        </Appear>
      ) : (
        <>
          <Appear delay={120} style={styles.grid}>
            <Figure label="Left to save" value={formatMoney(goal.target_cents - saved, currency, { compact: true })} />
            <Figure label="Set aside a month" value={setAside > 0 ? formatMoney(setAside, currency, { compact: true }) : '—'} />
            <Figure label="You’ll get there" value={arrival ? monthName(arrival, t) : '—'} />
            <Figure label="Started" value={formatDay(goal.started_on, { day: 'numeric', month: 'short' })} />
          </Appear>
          <Button title="Add money" onPress={() => money.open('add')} style={{ marginTop: 32 }} />
          {saved > 0 && <TextLink label="Take money out" onPress={() => money.open('take')} style={{ alignSelf: 'center', marginTop: 8 }} />}
        </>
      )}

      <Rule style={{ marginTop: 32 }} />
      <SectionHeader index="01" title="Saved so far" />
      {deposits.length === 0 ? (
        <AppText muted style={{ marginTop: 12 }}>
          Nothing yet. Add your first {setAside > 0 ? `${formatMoney(setAside, currency, { compact: true })} ` : ''}when it goes into savings.
        </AppText>
      ) : (
        <View style={{ marginTop: 12 }}>
          {deposits.map((d, i) => {
            const title = d.note || (d.kind === 'withdrawal' ? 'Taken out' : d.kind === 'starting' ? 'Already saved' : 'Added');
            const when = formatDay(d.occurred_on, { weekday: 'long', day: 'numeric', month: 'long' });
            return (
              <Appear key={d.id} delay={entrance(i) ?? 0} skip={entrance(i) === undefined}>
                <MoneyRow
                  mark={d.kind === 'withdrawal' ? 'left' : 'savings'}
                  title={title}
                  subtitle={when}
                  figure={formatFigure(d.kind === 'withdrawal' ? -d.amount_cents : d.amount_cents, currency, { sign: true })}
                  onPress={() => remove(d)}
                  accessibilityLabel={`${title}, ${formatMoney(d.amount_cents, currency)}, ${when}. Remove`}
                />
              </Appear>
            );
          })}
        </View>
      )}
      {!reached && (
        <AppText variant="caption" muted style={{ marginTop: 28 }}>
          {setAside > 0
            ? `Your ${formatMoney(setAside, currency, { compact: true })} a month is already kept out of what’s safe to spend. When you move it into savings, add it here. Anything extra you add comes out of what’s safe to spend.`
            : projection(state, setAside, currency, t)}
        </AppText>
      )}

      {money.sheet && (
        <MoneySheet
          key={money.sheet.key}
          open={money.sheet.open}
          mode={money.sheet.mode}
          forMonth={money.sheet.forMonth}
          onClose={money.close}
          onGone={money.gone}
          state={state}
          setAside={setAside}
          currency={currency}
        />
      )}
      {dialog}
    </Screen>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ width: '45%', flexGrow: 1 }}>
      <AppText variant="small" muted>
        {label}
      </AppText>
      <AppText variant="number" style={{ marginTop: 4 }}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 24, rowGap: 20, marginTop: 32 },
});
