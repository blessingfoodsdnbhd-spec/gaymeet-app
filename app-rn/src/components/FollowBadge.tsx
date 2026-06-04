import React from 'react';
import { View } from 'react-native';
import { Heart, Check } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Small follow-relationship indicator shown next to a user's name.
 *   mutual      → filled heart  (you follow each other)
 *   following   → check         (you follow them, one-way)
 *   followed-by → small dot     (they follow you, one-way)
 *   none/undef  → nothing
 */
export function FollowBadge({
  status,
  size = 14,
}: {
  status?: 'mutual' | 'following' | 'followed-by' | 'none';
  size?: number;
}) {
  const theme = useTheme();
  if (status === 'mutual') {
    return <Heart size={size} color={theme.colors.primary} fill={theme.colors.primary} />;
  }
  if (status === 'following') {
    return <Check size={size} color={theme.colors.primary} strokeWidth={2.6} />;
  }
  if (status === 'followed-by') {
    return (
      <View
        style={{
          width: Math.round(size * 0.42),
          height: Math.round(size * 0.42),
          borderRadius: 999,
          backgroundColor: theme.colors.muted,
        }}
      />
    );
  }
  return null;
}
