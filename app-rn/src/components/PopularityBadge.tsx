import React from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeProvider';

/**
 * 人气 / popularity chip (RRRR) — "🔥 人气 N" where N = totalLikesReceived +
 * followersCount (computed server-side in toPublicJSON). Brand-pink chip.
 * Hidden when popularity is below `min` (default 1) so we never render "🔥 0".
 */
export function PopularityBadge({
  value,
  min = 1,
  size = 'sm',
}: {
  value?: number | null;
  min?: number;
  size?: 'sm' | 'md';
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const n = value ?? 0;
  if (n < min) return null;
  const fs = size === 'md' ? 13 : 11.5;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: theme.colors.primarySoft,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: theme.radius.pill,
      }}
    >
      <Text style={{ fontSize: fs }}>🔥</Text>
      <Text style={{ fontSize: fs, fontWeight: '600', color: theme.colors.primaryDeep }}>
        {t('popularity.label')}
      </Text>
      <Text style={{ fontSize: fs, fontWeight: '700', color: theme.colors.primaryDeep }}>{n}</Text>
    </View>
  );
}
