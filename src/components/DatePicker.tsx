import { useState } from 'react';
import { View } from 'react-native';

import { Chip, Field, Row } from './ui';
import { addDays, formatDay, isValidISODate, today } from '@/lib/dates';
import { space } from '@/theme/tokens';

/** Today / Yesterday chips plus a typed date for anything older. */
export function DatePicker({ value, onChange, label = 'Date' }: { value: string; onChange: (iso: string) => void; label?: string }) {
  const t = today();
  const y = addDays(t, -1);
  const [custom, setCustom] = useState(value !== t && value !== y);
  const [text, setText] = useState(value);

  return (
    <View style={{ gap: space.sm }}>
      <Row style={{ flexWrap: 'wrap' }}>
        <Chip label="Today" selected={!custom && value === t} onPress={() => { setCustom(false); onChange(t); }} />
        <Chip label="Yesterday" selected={!custom && value === y} onPress={() => { setCustom(false); onChange(y); }} />
        <Chip
          label={custom && isValidISODate(value) ? formatDay(value) : 'Other date'}
          icon="calendar-outline"
          selected={custom}
          onPress={() => { setCustom(true); setText(value); }}
        />
      </Row>
      {custom && (
        <Field
          label={label}
          value={text}
          placeholder="YYYY-MM-DD"
          autoCorrect={false}
          maxLength={10}
          keyboardType="numbers-and-punctuation"
          onChangeText={(s) => {
            setText(s);
            if (isValidISODate(s)) onChange(s);
          }}
          hint={isValidISODate(text) ? formatDay(text, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : 'Use the format 2026-10-23'}
        />
      )}
    </View>
  );
}
