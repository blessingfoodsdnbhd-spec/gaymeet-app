import React, { useState } from 'react';
import { Modal, Platform, Pressable, Text, View } from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeProvider';

/** Local "YYYY-MM-DD" (no timezone shift — uses local date parts). */
export function formatYMD(d: Date | null): string | null {
  if (!d) return null;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Parse "YYYY-MM-DD" into a LOCAL Date (avoids the UTC-midnight off-by-one). */
export function parseYMD(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/**
 * Date-only field backed by the native picker.
 *   iOS → a 'date' spinner inside a bottom sheet (Cancel / Done).
 *   Android → the OS date dialog.
 * Used for DOB: bounded to [minDate, maxDate]; default lands on maxDate-ish so
 * the wheel doesn't open on today (you can't be born today and be 13+).
 */
export function DateField({
  label,
  value,
  onChange,
  minDate,
  maxDate,
  placeholder,
  defaultDate,
}: {
  label: string;
  value: Date | null;
  onChange: (d: Date) => void;
  minDate?: Date;
  maxDate?: Date;
  placeholder?: string;
  /** What the wheel opens on when there's no value yet. */
  defaultDate?: Date;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [mode, setMode] = useState<null | 'ios' | 'android'>(null);
  const initial = value ?? defaultDate ?? new Date();
  const [draft, setDraft] = useState<Date>(initial);

  const open = () => {
    setDraft(value ?? defaultDate ?? new Date());
    setMode(Platform.OS === 'ios' ? 'ios' : 'android');
  };

  const onAndroidChange = (e: DateTimePickerEvent, d?: Date) => {
    setMode(null);
    if (e.type === 'set' && d) onChange(d);
  };

  const display = formatYMD(value);

  return (
    <View style={{ marginBottom: 4 }}>
      <Pressable
        onPress={open}
        style={{
          borderWidth: 1,
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 13,
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.line,
        }}
      >
        <Text style={{ fontSize: 15, color: display ? theme.colors.text : theme.colors.muted }}>
          {display ?? placeholder ?? label}
        </Text>
      </Pressable>

      {mode === 'android' && (
        <DateTimePicker
          value={draft}
          mode="date"
          minimumDate={minDate}
          maximumDate={maxDate}
          onChange={onAndroidChange}
        />
      )}

      {mode === 'ios' && (
        <Modal transparent statusBarTranslucent animationType="fade" onRequestClose={() => setMode(null)}>
          <Pressable
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}
            onPress={() => setMode(null)}
          >
            <Pressable
              onPress={() => {}}
              style={{
                backgroundColor: theme.colors.surface,
                borderTopLeftRadius: 18,
                borderTopRightRadius: 18,
                paddingBottom: 28,
                paddingTop: 8,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 }}>
                <Pressable onPress={() => setMode(null)}>
                  <Text style={{ color: theme.colors.muted, fontSize: 16 }}>{t('common.cancel')}</Text>
                </Pressable>
                <Pressable onPress={() => { onChange(draft); setMode(null); }}>
                  <Text style={{ color: theme.colors.primary, fontSize: 16, fontWeight: '600' }}>
                    {t('admin.ann.done')}
                  </Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={draft}
                mode="date"
                display="spinner"
                minimumDate={minDate}
                maximumDate={maxDate}
                onChange={(_e, d) => d && setDraft(d)}
              />
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}
