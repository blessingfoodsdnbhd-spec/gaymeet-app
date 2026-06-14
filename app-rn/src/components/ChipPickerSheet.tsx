import React from 'react';
import { View, Text, ScrollView } from 'react-native';
// RNGH Pressable so chips respond to the first Android tap inside the Sheet's
// GestureHandlerRootView (otherwise the ScrollView eats the first touch). (#231)
import { Pressable } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';
import { Sheet } from './Sheet';
import { useTheme } from '../theme/ThemeProvider';

export interface ChipOption {
  id: string;
  label: string;
}

/**
 * Reusable chip picker in a bottom sheet (GGGG-3). Single-select closes on tap;
 * multi-select stays open with a Done button. Used by EditProfileScreen's
 * competitor-style field rows so categorical fields open a sheet instead of
 * rendering a wall of chips inline.
 */
export function ChipPickerSheet({
  open,
  onClose,
  title,
  options,
  selected,
  multi = false,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  options: ChipOption[];
  selected: string[];
  multi?: boolean;
  onChange: (next: string[]) => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();

  const toggle = (id: string) => {
    if (multi) {
      onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
    } else {
      onChange(selected.includes(id) ? [] : [id]); // tap again clears
      onClose();
    }
  };

  return (
    <Sheet open={open} onClose={onClose} maxHeight="70%">
      <Text style={{ fontSize: theme.typography.size.h3, fontWeight: '700', color: theme.colors.text, marginBottom: 14 }}>
        {title}
      </Text>
      <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {options.map((o) => {
            const active = selected.includes(o.id);
            return (
              <Pressable
                key={o.id}
                onPress={() => toggle(o.id)}
                style={({ pressed }) => ({
                  paddingHorizontal: 16,
                  paddingVertical: 9,
                  borderRadius: theme.radius.pill,
                  backgroundColor: active ? theme.colors.primarySoft : theme.colors.surface2,
                  borderWidth: active ? 0 : 1,
                  borderColor: theme.colors.line,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ fontSize: 14, fontWeight: '500', color: active ? theme.colors.primaryDeep : theme.colors.text2 }}>
                  {o.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      {multi && (
        <Pressable onPress={onClose} hitSlop={8} style={{ marginTop: 18, alignSelf: 'center' }}>
          <Text style={{ color: theme.colors.primary, fontSize: 15, fontWeight: '700' }}>{t('common.ok')}</Text>
        </Pressable>
      )}
    </Sheet>
  );
}
