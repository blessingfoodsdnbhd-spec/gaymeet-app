import React, { useState } from 'react';
import { Modal, Platform, Pressable, Text, View } from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';

/** "2026-06-10 00:00" */
export function formatDateTime(d: Date | null): string | null {
  if (!d) return null;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function nextHour(): Date {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

/**
 * A start/end date-time field backed by the native picker.
 *   iOS → a single 'datetime' spinner inside a bottom sheet.
 *   Android → the OS date dialog, then the time dialog (Android can't do both
 *   at once), combined into one value.
 * Optional: a ✕ clears the value back to null ("always-on / indefinite").
 */
export function DateTimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Date | null;
  onChange: (d: Date | null) => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [mode, setMode] = useState<null | 'ios' | 'android-date' | 'android-time'>(null);
  const [draft, setDraft] = useState<Date>(value ?? nextHour());

  const open = () => {
    setDraft(value ?? nextHour());
    setMode(Platform.OS === 'ios' ? 'ios' : 'android-date');
  };

  // Android fires once per dialog; chain date → time.
  const onAndroidChange = (e: DateTimePickerEvent, d?: Date) => {
    if (e.type !== 'set' || !d) {
      setMode(null);
      return;
    }
    if (mode === 'android-date') {
      const merged = new Date(draft);
      merged.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
      setDraft(merged);
      setMode('android-time');
    } else {
      const final = new Date(draft);
      final.setHours(d.getHours(), d.getMinutes(), 0, 0);
      onChange(final);
      setMode(null);
    }
  };

  const display = formatDateTime(value);

  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 12, marginBottom: 6, fontWeight: '500', color: theme.colors.text2 }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Pressable
          onPress={open}
          style={{
            flex: 1,
            borderWidth: 1,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 11,
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.line,
          }}
        >
          <Text style={{ fontSize: 14, color: display ? theme.colors.text : theme.colors.muted }}>
            {display ?? t('admin.ann.notSet')}
          </Text>
        </Pressable>
        {value && (
          <Pressable onPress={() => onChange(null)} hitSlop={8}>
            <X size={18} color={theme.colors.muted} />
          </Pressable>
        )}
      </View>

      {/* Android: imperative dialogs */}
      {(mode === 'android-date' || mode === 'android-time') && (
        <DateTimePicker
          value={draft}
          mode={mode === 'android-date' ? 'date' : 'time'}
          is24Hour
          onChange={onAndroidChange}
        />
      )}

      {/* iOS: spinner inside a bottom sheet */}
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
                mode="datetime"
                display="spinner"
                onChange={(_e, d) => d && setDraft(d)}
              />
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}
