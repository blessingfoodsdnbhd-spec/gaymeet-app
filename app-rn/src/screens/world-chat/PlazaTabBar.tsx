import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { ChevronDown, Search } from 'lucide-react-native';

import { useTheme } from '../../theme/ThemeProvider';

/** The five Plaza sections. 'hot' is the default landing. */
export type PlazaTab = 'hot' | 'match' | 'voice' | 'interest' | 'country';

export interface PlazaPill {
  /** e.g. "🇲🇾 Malaysia" — the room currently shown in this tab. */
  label: string;
  /** Live online count, or null while unknown. */
  count: number | null;
  /** Opens the switcher sheet for the active tab. */
  onPress: () => void;
}

interface Props {
  tabs: { key: PlazaTab; label: string }[];
  active: PlazaTab;
  onChange: (k: PlazaTab) => void;
  /** Current-room switcher pill (only on tabs that switch rooms). */
  pill?: PlazaPill | null;
  /** Opens Plaza search (rooms / messages / users). */
  onSearch?: () => void;
}

/**
 * Top of the 广场 tab: a scrollable row of section pills (🔥 ❤️ 🎤 🎮 🌏) and,
 * for room-backed sections, a second "current room" pill that opens the
 * switcher sheet. Replaces the old hot-rooms strip + hamburger drawer — there
 * is exactly one way to switch, and no duplicate navigation.
 */
export function PlazaTabBar({ tabs, active, onChange, pill, onSearch }: Props) {
  const theme = useTheme();

  return (
    <View style={{ borderBottomColor: theme.colors.line, borderBottomWidth: StyleSheet.hairlineWidth }}>
      <View style={styles.topRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsRow}
          style={{ flex: 1 }}
        >
          {tabs.map((tab) => {
          const isActive = tab.key === active;
          return (
            <Pressable
              key={tab.key}
              onPress={() => onChange(tab.key)}
              style={[
                styles.tab,
                {
                  backgroundColor: isActive ? theme.colors.primary : theme.colors.surface2,
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: isActive ? '800' : '600',
                  color: isActive ? '#FFFFFF' : theme.colors.text2,
                }}
              >
                  {tab.label}
              </Text>
            </Pressable>
            );
          })}
        </ScrollView>

        {onSearch && (
          <Pressable
            onPress={onSearch}
            hitSlop={8}
            style={({ pressed }) => [styles.searchBtn, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Search size={20} color={theme.colors.text} strokeWidth={1.8} />
          </Pressable>
        )}
      </View>

      {pill && (
        <Pressable
          onPress={pill.onPress}
          style={({ pressed }) => [
            styles.pill,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.line, opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 14.5, fontWeight: '700', color: theme.colors.text }}>
            {pill.label}
          </Text>
          {pill.count != null && (
            <View style={styles.countWrap}>
              <View style={[styles.dot, { backgroundColor: theme.colors.online }]} />
              <Text style={{ fontSize: 12.5, fontWeight: '700', color: theme.colors.muted }}>{pill.count}</Text>
            </View>
          )}
          <ChevronDown size={16} color={theme.colors.muted} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center' },
  searchBtn: { paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  tabsRow: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  tab: { paddingHorizontal: 14, height: 34, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginBottom: 10,
    paddingHorizontal: 14,
    height: 38,
    borderRadius: 999,
    borderWidth: 1,
  },
  countWrap: { flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: 'auto' },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
