import * as React from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Input, Text } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { radius, space, useTheme } from '@/lib/theme';

const toYmd = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const fromYmd = (value: string) => (value ? new Date(`${value}T12:00:00`) : new Date());

/** A date (Y-m-d or ""), shown as dd-mmm-yyyy. Native picker on phones; typed on web. */
export function DateField({ label, value, onChange, disabled }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const theme = useTheme();
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(fromYmd(value));

  if (Platform.OS === 'web') {
    return <Input label={label} value={value} editable={!disabled} placeholder="yyyy-mm-dd" onChangeText={(text) => /^\d{4}-\d{2}-\d{2}$/.test(text) || text === '' ? onChange(text) : undefined} />;
  }

  const show = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: fromYmd(value),
        mode: 'date',
        onChange: (event, date) => {
          if (event.type === 'set' && date) onChange(toYmd(date));
        },
      });
      return;
    }
    setDraft(fromYmd(value));
    setOpen(true);
  };

  return (
    <View style={{ gap: space.xs, flex: 1 }}>
      <Text size={13} weight="600">
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ? formatDate(value) : 'none'}`}
        disabled={disabled}
        onPress={show}
        onLongPress={() => value && onChange('')}
        style={[styles.field, { borderColor: theme.border, backgroundColor: theme.card, opacity: disabled ? 0.6 : 1 }]}
      >
        <Text tone={value ? undefined : 'muted'}>{value ? formatDate(value) : 'None'}</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: theme.overlay }]} onPress={() => setOpen(false)} />
        <SafeAreaView edges={['bottom']} style={[styles.sheet, { backgroundColor: theme.card }]}>
          <DateTimePicker value={draft} mode="date" display="inline" onChange={(_event, date) => date && setDraft(date)} />
          <View style={{ flexDirection: 'row', gap: space.sm, padding: space.lg }}>
            <Button title="Clear" variant="outline" style={{ flex: 1 }} onPress={() => { onChange(''); setOpen(false); }} />
            <Button title="Set date" style={{ flex: 1 }} onPress={() => { onChange(toYmd(draft)); setOpen(false); }} />
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { minHeight: 44, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, justifyContent: 'center' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingTop: space.md },
});
