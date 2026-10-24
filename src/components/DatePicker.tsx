import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, View } from 'react-native';

import { Chip, Field, Row } from './ui';
import { addDays, formatDay, isValidISODate, parseISODate, toISODate, today } from '@/lib/dates';
import { space, useColors, useIsDark } from '@/theme/tokens';

/** Today / Yesterday chips, plus the phone's own calendar for older dates (typed on web). */
export function DatePicker({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const c = useColors();
  const dark = useIsDark();
  const t = today();
  const y = addDays(t, -1);
  const isOther = value !== t && value !== y;
  const [showIOS, setShowIOS] = useState(false);
  const [text, setText] = useState(value);

  const pick = (_e: DateTimePickerEvent, date?: Date) => {
    if (date) onChange(toISODate(date));
  };

  const openOther = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ value: parseISODate(value), mode: 'date', maximumDate: new Date(), onChange: pick });
    } else if (Platform.OS === 'ios') {
      setShowIOS((v) => !v);
    } else {
      setText(value);
      setShowIOS(true);
    }
  };

  return (
    <View style={{ gap: space.sm }}>
      <Row style={{ flexWrap: 'wrap' }}>
        <Chip label="Today" selected={value === t} onPress={() => { setShowIOS(false); onChange(t); }} />
        <Chip label="Yesterday" selected={value === y} onPress={() => { setShowIOS(false); onChange(y); }} />
        <Chip label={isOther && isValidISODate(value) ? formatDay(value) : 'Pick a date'} icon="calendar-outline" selected={isOther} onPress={openOther} />
      </Row>
      {showIOS && Platform.OS === 'ios' && (
        <DateTimePicker
          value={parseISODate(value)}
          mode="date"
          display="inline"
          maximumDate={new Date()}
          onChange={pick}
          accentColor={c.primary}
          themeVariant={dark ? 'dark' : 'light'}
        />
      )}
      {showIOS && Platform.OS === 'web' && (
        <Field
          value={text}
          placeholder="YYYY-MM-DD"
          autoCorrect={false}
          maxLength={10}
          onChangeText={(s) => {
            setText(s);
            if (isValidISODate(s) && s <= t) onChange(s);
          }}
          hint={isValidISODate(text) ? formatDay(text, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : 'Use the format 2026-10-23'}
        />
      )}
    </View>
  );
}
