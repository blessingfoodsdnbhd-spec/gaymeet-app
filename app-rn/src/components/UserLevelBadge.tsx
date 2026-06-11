import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeProvider';

/** Tier accent: higher levels glow warmer (toward the 传奇 gold). */
function tierColor(level: number, theme: ReturnType<typeof useTheme>) {
  if (level >= 20) return theme.colors.warning; // 传奇吹水王 — gold
  if (level >= 15) return theme.colors.error;
  if (level >= 10) return theme.colors.secondary; // 资深成员 — purple
  if (level >= 5) return theme.colors.primary; // 常客 — brand pink
  return theme.colors.info; // 新人 — blue
}

/**
 * Compact "Lv5" chip shown next to a user's name (chat rows, online list,
 * leaderboard). Color-bands by tier so veterans read at a glance.
 */
export function UserLevelBadge({ level, size = 'sm' }: { level: number; size?: 'sm' | 'md' }) {
  const theme = useTheme();
  const c = tierColor(level, theme);
  const md = size === 'md';
  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: c + '22', // 13% tint
          borderColor: c + '55',
          paddingHorizontal: md ? 8 : 6,
          paddingVertical: md ? 3 : 1.5,
          borderRadius: theme.radius.s,
        },
      ]}
    >
      <Text style={{ color: c, fontSize: md ? 13 : 10.5, fontWeight: '800', letterSpacing: 0.2 }}>
        Lv{level}
      </Text>
    </View>
  );
}

/**
 * Larger level display with the tier name + an XP progress bar. For profile
 * headers and the leaderboard hero. Pass a LevelInfo-shaped object.
 */
export function LevelProgress({
  level,
  levelName,
  totalXP,
  currentLevelXP,
  nextLevelXP,
  progress,
}: {
  level: number;
  levelName: string; // i18n key
  totalXP: number;
  currentLevelXP: number;
  nextLevelXP: number | null;
  progress: number;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const c = tierColor(level, theme);
  const pct = Math.round(Math.max(0, Math.min(1, progress)) * 100);
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <UserLevelBadge level={level} size="md" />
        <Text style={{ fontSize: 15, fontWeight: '700', color: theme.colors.text }}>{t(levelName)}</Text>
        <Text style={{ fontSize: 12, color: theme.colors.muted, marginLeft: 'auto' }}>
          {nextLevelXP != null
            ? `${totalXP} / ${nextLevelXP} XP`
            : t('plaza.level.maxed', { xp: totalXP })}
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: theme.colors.surface2 }]}>
        <View
          style={{
            width: `${pct}%`,
            height: '100%',
            backgroundColor: c,
            borderRadius: 999,
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  track: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
});
