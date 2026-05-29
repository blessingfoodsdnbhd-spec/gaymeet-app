import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeProvider';
import type { Topic } from '../../api/topics';

/**
 * Discover topic-tab strip — horizontal scrolling pills. The two
 * "system" tabs (推薦 / 附近) come first; topic tabs follow in
 * Topic.order. Active tab is filled, inactive is outlined.
 *
 * The active tab is identified by:
 *   { kind: 'cards' | 'nearby' }       ← system
 *   { kind: 'topic'; slug: string }    ← topic
 */
export type ActiveTab =
  | { kind: 'cards' }
  | { kind: 'nearby' }
  | { kind: 'topic'; slug: string };

interface Props {
  topics: Topic[];
  active: ActiveTab;
  onChange: (next: ActiveTab) => void;
  locale: 'en' | 'zh';
}

export function TopicTabs({ topics, active, onChange, locale }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();

  // Render a single pill.
  const Pill = ({
    label,
    icon,
    isActive,
    onPress,
  }: {
    label: string;
    icon?: string;
    isActive: boolean;
    onPress: () => void;
  }) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        {
          backgroundColor: isActive
            ? theme.colors.primary
            : theme.colors.surface,
          borderColor: isActive ? theme.colors.primary : theme.colors.line,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {icon ? <Text style={styles.icon}>{icon}</Text> : null}
      <Text
        style={[
          styles.label,
          { color: isActive ? '#FFFFFF' : theme.colors.text2 },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.line }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        <Pill
          label={t('discover.modeCards')}
          isActive={active.kind === 'cards'}
          onPress={() => onChange({ kind: 'cards' })}
        />
        <Pill
          label={t('discover.modeNearby')}
          isActive={active.kind === 'nearby'}
          onPress={() => onChange({ kind: 'nearby' })}
        />
        {topics.map((tp) => (
          <Pill
            key={tp.slug}
            label={tp.name[locale] ?? tp.name.en ?? tp.slug}
            icon={tp.icon || undefined}
            isActive={active.kind === 'topic' && active.slug === tp.slug}
            onPress={() => onChange({ kind: 'topic', slug: tp.slug })}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  icon: { fontSize: 14 },
  label: { fontSize: 13.5, fontWeight: '600' },
});
