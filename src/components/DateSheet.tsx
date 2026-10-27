import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from './icons';
import { Sheet } from './Sheet';
import { AppText, Chip, haptic, IconButton, TextLink } from './ui';
import { addDays, addMonths, daysInMonth, formatDay, parseISODate, startOfMonth, toISODate, today } from '@/lib/dates';
import { colors, fonts } from '@/theme/tokens';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** "Today, Sunday 25 October", "Yesterday, Saturday 24 October", "Friday 23 October". */
export function dayLabel(iso: string, now = today()): string {
  const long = formatDay(iso, { weekday: 'long', day: 'numeric', month: 'long' });
  if (iso === now) return `Today, ${long}`;
  if (iso === addDays(now, -1)) return `Yesterday, ${long}`;
  return long;
}

/** Quick picks for the last three days, and a month calendar for anything older. No future dates. */
export function DateSheet({ open, onClose, value, onChange }: { open: boolean; onClose: () => void; value: string; onChange: (iso: string) => void }) {
  const t = today();
  const [month, setMonth] = useState(startOfMonth(value));
  const quick = [t, addDays(t, -1), addDays(t, -2)];
  const m = parseISODate(month);
  const lead = (m.getDay() + 6) % 7;
  const days = daysInMonth(m.getFullYear(), m.getMonth());
  const cells: (string | null)[] = [...Array.from({ length: lead }, () => null), ...Array.from({ length: days }, (_, i) => toISODate(new Date(m.getFullYear(), m.getMonth(), i + 1)))];
  const canNext = addMonths(month, 1) <= t;

  const choose = (iso: string) => {
    haptic('select');
    onChange(iso);
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose}>
      <View style={styles.head}>
        <AppText variant="title" accessibilityRole="header">
          Date
        </AppText>
        <TextLink label="Done" onPress={onClose} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        {quick.map((d, i) => (
          <Chip
            key={d}
            label={i === 0 ? 'Today' : i === 1 ? 'Yesterday' : formatDay(d, { weekday: 'long' })}
            selected={value === d}
            onPress={() => choose(d)}
          />
        ))}
      </View>
      <View style={styles.monthRow}>
        <AppText weight="medium">{m.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</AppText>
        <View style={{ flexDirection: 'row' }}>
          <IconButton icon="back" label="Previous month" iconSize={16} onPress={() => setMonth(addMonths(month, -1))} />
          {canNext ? (
            <IconButton icon="chevron" label="Next month" iconSize={16} onPress={() => setMonth(addMonths(month, 1))} />
          ) : (
            <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}>
              <Icon name="chevron" size={16} />
            </View>
          )}
        </View>
      </View>
      <View style={styles.weekdays} aria-hidden>
        {WEEKDAYS.map((d, i) => (
          <AppText key={i} variant="axis" muted center style={{ flex: 1, lineHeight: 14 }}>
            {d}
          </AppText>
        ))}
      </View>
      <View style={styles.grid} accessibilityRole="list">
        {cells.map((iso, i) =>
          iso ? (
            <Pressable
              key={iso}
              disabled={iso > t}
              onPress={() => choose(iso)}
              accessibilityRole="button"
              accessibilityLabel={formatDay(iso, { weekday: 'long', day: 'numeric', month: 'long' })}
              accessibilityState={{ selected: iso === value, disabled: iso > t }}
              style={[styles.day, iso === value && { backgroundColor: colors.ink }]}>
              <AppText
                style={{
                  color: iso === value ? colors.onInk : iso > t ? colors.grey : colors.ink,
                  fontFamily: iso === value || iso === t ? fonts.medium : fonts.regular,
                  textDecorationLine: iso === t && iso !== value ? 'underline' : 'none',
                }}>
                {Number(iso.slice(8))}
              </AppText>
            </Pressable>
          ) : (
            <View key={`e${i}`} style={styles.day} />
          ),
        )}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  monthRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  weekdays: { flexDirection: 'row', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.rule },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  day: { width: `${100 / 7}%`, height: 44, alignItems: 'center', justifyContent: 'center' },
});
