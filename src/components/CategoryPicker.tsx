import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { View } from 'react-native';

import { NeedWantToggle } from './money-ui';
import { AppText, Button, Card, Chip, Field, Row } from './ui';
import type { Necessity } from '../../shared/schemas';
import { setSettings } from '@/db/settings';
import { CATEGORY_INFO, EXPENSE_CATEGORIES, INCOME_CATEGORIES, type CustomCategory } from '@/lib/categories';
import { usePro, useRequirePro } from '@/lib/pro';
import { space } from '@/theme/tokens';

export function CategoryPicker({
  type,
  value,
  onChange,
  custom,
}: {
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

  const ids: string[] = type === 'income' ? [...INCOME_CATEGORIES] : [...EXPENSE_CATEGORIES];

  const save = async () => {
    const clean = label.trim();
    if (!clean) return;
    const id = `custom:${clean.toLowerCase().replace(/\s+/g, '_')}`;
    const next = [...custom.filter((c) => c.id !== id), { id, label: clean, necessity }];
    await setSettings(db, { custom_categories: JSON.stringify(next) });
    onChange(id, necessity);
    setAdding(false);
    setLabel('');
  };

  return (
    <View style={{ gap: space.md }}>
      <Row style={{ flexWrap: 'wrap' }}>
        {ids.map((id) => {
          const info = CATEGORY_INFO[id as keyof typeof CATEGORY_INFO];
          return (
            <Chip key={id} label={info.label} icon={info.icon} selected={value === id} onPress={() => onChange(id, info.necessity)} />
          );
        })}
        {type === 'expense' &&
          custom.map((cc) => (
            <Chip
              key={cc.id}
              label={cc.label}
              icon="pricetag-outline"
              selected={value === cc.id}
              onPress={() => onChange(cc.id, cc.necessity)}
            />
          ))}
        {type === 'expense' && (
          <Chip
            label="New"
            icon="add"
            locked={!isPro}
            onPress={() => {
              if (requirePro('custom_categories')) setAdding(true);
            }}
          />
        )}
      </Row>
      {adding && (
        <Card>
          <AppText variant="title">New category</AppText>
          <Field value={label} onChangeText={setLabel} placeholder="e.g. Pet care" maxLength={24} autoFocus />
          <AppText variant="caption" weight="semibold" muted>
            Usually a…
          </AppText>
          <NeedWantToggle value={necessity} onChange={setNecessity} />
          <Row>
            <Button title="Add category" icon="add" onPress={save} style={{ flex: 1 }} />
            <Button title="Cancel" kind="ghost" onPress={() => setAdding(false)} />
          </Row>
        </Card>
      )}
    </View>
  );
}
