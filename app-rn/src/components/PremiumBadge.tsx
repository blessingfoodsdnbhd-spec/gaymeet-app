import React from 'react';
import { View, Text } from 'react-native';
import { Crown } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useTranslation } from 'react-i18next';

/**
 * Premium identity chip (SSSSS) — 👑 + "Premium" pill shown next to a user's
 * name to signal an active Premium membership. Brand-pink, mirrors the
 * PopularityBadge pattern. Renders nothing when the user is not Premium.
 */
export function PremiumBadge({
  isPremium,
  size = 'sm',
}: {
  isPremium?: boolean | null;
  size?: 'sm' | 'md';
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  if (!isPremium) return null;
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
      <Crown size={theme.iconSize.xs} color={theme.colors.primaryDeep} strokeWidth={2} />
      <Text style={{ fontSize: fs, fontWeight: '700', color: theme.colors.primaryDeep }}>
        {t('premium.badge')}
      </Text>
    </View>
  );
}
