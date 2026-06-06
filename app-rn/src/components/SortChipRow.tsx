import React from 'react';
import { ScrollView, Pressable, Text } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export interface SortOption {
  key: string;
  label: string;
}

/** Horizontal pill row for choosing a list sort. Active pill = brand color. */
export function SortChipRow({
  options,
  active,
  onChange,
}: {
  options: SortOption[];
  active: string;
  onChange: (key: string) => void;
}) {
  const theme = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}
    >
      {options.map((o) => {
        const on = o.key === active;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={{
              paddingHorizontal: 14,
              height: 32,
              borderRadius: 16,
              borderWidth: 1,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: on ? theme.colors.primary : 'transparent',
              borderColor: on ? theme.colors.primary : theme.colors.line,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: on ? '#FFFFFF' : theme.colors.text }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
