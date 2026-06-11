import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

/** Plaza role tags (Phase 3), computed server-side in User.toPublicJSON. */
export type RoleTag = 'admin' | 'vip' | 'veteran' | 'new' | 'normal';

/** i18n key for a tag's label, e.g. `t(roleLabelKey('vip'))`. */
export function roleLabelKey(tag: RoleTag): string {
  return `role.${tag}`;
}

/**
 * A small coloured dot signalling a user's standing, shown inline next to their
 * name in chat / sidebar / profile. The colour comes from `theme.colors.roleColors`.
 *
 * Renders nothing for an unknown/absent tag. `normal` is the neutral grey dot —
 * pass `hideNormal` where a dot on everyone would be noise (e.g. dense lists).
 */
export function RoleDot({
  tag,
  size = 8,
  hideNormal = false,
}: {
  tag?: RoleTag | null;
  size?: number;
  hideNormal?: boolean;
}) {
  const theme = useTheme();
  if (!tag) return null;
  if (tag === 'normal' && hideNormal) return null;
  const color = theme.colors.roleColors[tag] ?? theme.colors.roleColors.normal;
  return (
    <View
      accessibilityLabel={`role-${tag}`}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }}
    />
  );
}
