import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';

import { useTheme } from '../../theme/ThemeProvider';
import { Sheet } from '../../components/Sheet';

export interface SwitchRoom {
  id: string;
  flag: string;
  name: string;
  onlineCount: number;
}

interface Props {
  open: boolean;
  title: string;
  rooms: SwitchRoom[];
  activeId?: string | null;
  onSelect: (r: SwitchRoom) => void;
  onClose: () => void;
}

/**
 * Bottom-sheet room switcher for a Plaza section (热门 / 国家). Lists rooms with
 * live online counts; tapping one switches the chat in-place and closes the
 * sheet. This is the ONLY way to switch rooms within a tab — no drawer.
 */
export function PlazaSwitcherSheet({ open, title, rooms, activeId, onSelect, onClose }: Props) {
  const theme = useTheme();

  return (
    <Sheet open={open} onClose={onClose} maxHeight="70%">
      <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
      <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ paddingBottom: 12 }}>
        {rooms.map((r) => {
          const isActive = r.id === activeId;
          return (
            <Pressable
              key={r.id}
              onPress={() => onSelect(r)}
              style={({ pressed }) => [
                styles.row,
                {
                  backgroundColor: isActive ? theme.colors.primarySoft : 'transparent',
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text style={{ fontSize: 22 }}>{r.flag}</Text>
              <Text
                numberOfLines={1}
                style={{
                  flex: 1,
                  fontSize: 15.5,
                  fontWeight: isActive ? '800' : '600',
                  color: isActive ? theme.colors.primaryDeep : theme.colors.text,
                }}
              >
                {r.name}
              </Text>
              <View style={styles.countWrap}>
                <View style={[styles.dot, { backgroundColor: theme.colors.online }]} />
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: theme.colors.muted }}>{r.onlineCount}</Text>
              </View>
              {isActive && <Check size={18} color={theme.colors.primary} strokeWidth={2.5} />}
            </Pressable>
          );
        })}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '800', paddingHorizontal: 18, paddingTop: 4, paddingBottom: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 14,
  },
  countWrap: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
