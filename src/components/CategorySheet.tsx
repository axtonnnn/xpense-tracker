import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Mark } from './marks';
import { NeedWantToggle } from './money-ui';
import { Sheet } from './Sheet';
import { AppText, Button, Chip, Field, haptic, ProTag, TextLink } from './ui';
import type { Necessity } from '../../shared/schemas';
import { setSettings } from '@/db/settings';
import { CATEGORY_INFO, EXPENSE_PICKER_ORDER, INCOME_CATEGORIES, type CustomCategory } from '@/lib/categories';
import { usePro, useRequirePro } from '@/lib/pro';
import { colors, fonts } from '@/theme/tokens';

/** The first few categories, offered as chips on the form; the rest are one tap away in the sheet. */
export const QUICK_EXPENSE = ['housing', 'utilities', 'groceries', 'transport', 'health', 'dining', 'entertainment', 'shopping'];

const NEED_ORDER = EXPENSE_PICKER_ORDER.filter((c) => CATEGORY_INFO[c].necessity === 'need');
const WANT_ORDER = EXPENSE_PICKER_ORDER.filter((c) => CATEGORY_INFO[c].necessity !== 'need' && c !== 'other').concat('other');

/** Every category in two groups, "Usually needs" and "Usually wants", plus your own (Pro). */
export function CategorySheet({
  open,
  onClose,
  type,
  value,
  onChange,
  custom,
}: {
  open: boolean;
  onClose: () => void;
  type: 'expense' | 'income';
  value: string;
  onChange: (id: string, necessity?: Necessity) => void;
  custom: CustomCategory[];
}) {
  const db = useSQLiteContext();
  const requirePro = useRequirePro();
  const { isPro } = usePro();
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [necessity, setNecessity] = useState<Necessity>('want');

  const pick = (id: string, n?: Necessity) => {
    haptic('select');
    onChange(id, n);
    onClose();
  };

  const save = async () => {
    const clean = label.trim();
    if (!clean) return;
    const id = `custom:${clean.toLowerCase().replace(/\s+/g, '_')}`;
    const next = [...custom.filter((c) => c.id !== id), { id, label: clean, necessity }];
    await setSettings(db, { custom_categories: JSON.stringify(next) });
    setAdding(false);
    setLabel('');
    pick(id, necessity);
  };

  const grid = (ids: { id: string; label: string; necessity?: Necessity }[]) => (
    <View style={styles.grid}>
      {ids.map((c) => (
        <Pressable
          key={c.id}
          onPress={() => pick(c.id, c.necessity)}
          accessibilityRole="button"
          accessibilityState={{ selected: value === c.id }}
          style={({ pressed }) => [styles.cell, { opacity: pressed ? 0.5 : 1 }]}>
          <AppText style={{ fontFamily: value === c.id ? fonts.medium : fonts.regular, flex: 1 }} numberOfLines={1}>
            {c.label}
          </AppText>
          {value === c.id && <Mark kind="need" size={6} />}
        </Pressable>
      ))}
    </View>
  );

  const info = (id: string) => ({ id, label: CATEGORY_INFO[id as keyof typeof CATEGORY_INFO].label, necessity: CATEGORY_INFO[id as keyof typeof CATEGORY_INFO].necessity });

  return (
    <Sheet open={open} onClose={onClose}>
      <View style={styles.head}>
        <AppText variant="title" accessibilityRole="header">
          Category
        </AppText>
        <TextLink label="Done" onPress={onClose} />
      </View>
      <ScrollView style={{ maxHeight: 520 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {type === 'income' ? (
          grid(INCOME_CATEGORIES.map(info))
        ) : (
          <>
            <Group kind="need" label="Usually needs" />
            {grid([...NEED_ORDER.map(info), ...custom.filter((c) => c.necessity === 'need')])}
            <Group kind="want" label="Usually wants" style={{ marginTop: 24 }} />
            {grid([...WANT_ORDER.map(info), ...custom.filter((c) => c.necessity !== 'need')])}
            {adding ? (
              <View style={{ marginTop: 24, gap: 16 }}>
                <Field label="Name" value={label} onChangeText={setLabel} placeholder="e.g. Gym, Pet care" maxLength={24} autoFocus />
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <AppText variant="caption" muted>
                    Usually a
                  </AppText>
                  <NeedWantToggle value={necessity} onChange={setNecessity} />
                </View>
                <Button title="Add category" onPress={save} disabled={!label.trim()} />
              </View>
            ) : (
              <Pressable
                onPress={() => {
                  if (requirePro('custom_categories')) setAdding(true);
                }}
                accessibilityRole="button"
                accessibilityLabel={isPro ? 'Your own category' : 'Your own category, needs Pro'}
                style={({ pressed }) => [styles.own, { opacity: pressed ? 0.5 : 1 }]}>
                <AppText style={{ textDecorationLine: 'underline' }}>Your own category</AppText>
                {!isPro && <ProTag />}
              </Pressable>
            )}
          </>
        )}
      </ScrollView>
    </Sheet>
  );
}

function Group({ kind, label, style }: { kind: 'need' | 'want'; label: string; style?: object }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 4 }, style]}>
      <Mark kind={kind} size={8} />
      <AppText variant="caption" muted>
        {label}
      </AppText>
    </View>
  );
}

/** Category chips for a form: the everyday ones, the chosen one, and "More…" for the full sheet. */
export function CategoryChips({
  type,
  value,
  onChange,
  onMore,
  custom,
}: {
  type: 'expense' | 'income';
  value: string;
  onChange: (id: string, necessity?: Necessity) => void;
  onMore: () => void;
  custom: CustomCategory[];
}) {
  const ids: string[] = type === 'income' ? [...INCOME_CATEGORIES] : QUICK_EXPENSE.includes(value) || !value ? QUICK_EXPENSE : [...QUICK_EXPENSE.slice(0, 7), value];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {ids.map((id) => {
        const known = CATEGORY_INFO[id as keyof typeof CATEGORY_INFO];
        const own = custom.find((c) => c.id === id);
        const lbl = known?.label ?? own?.label ?? id;
        return <Chip key={id} label={lbl} selected={value === id} onPress={() => onChange(id, known?.necessity ?? own?.necessity)} />;
      })}
      {type === 'expense' && <TextLink label="More…" onPress={onMore} style={{ minHeight: 36, paddingHorizontal: 12 }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 20 },
  cell: {
    width: '46%',
    flexGrow: 1,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  own: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 44, marginTop: 24 },
});
