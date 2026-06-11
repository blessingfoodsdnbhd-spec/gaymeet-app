import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

/** Plaza role badge (visual hierarchy). Mirrors backend utils/role.js. */
export type PlazaRole = 'admin' | 'vip' | 'veteran' | 'new' | 'normal';

/** Map a role → its dot color token. */
export function roleColor(theme: ReturnType<typeof useTheme>, role?: PlazaRole | string | null) {
  switch (role) {
    case 'admin':
      return theme.colors.roleAdmin;
    case 'vip':
      return theme.colors.roleVip;
    case 'veteran':
      return theme.colors.roleVeteran;
    case 'new':
      return theme.colors.roleNew;
    default:
      return theme.colors.roleNormal;
  }
}

/**
 * A small colored dot indicating a user's Plaza role. Accepts either an
 * explicit `role` string or a `user`-like object carrying `plazaRole`.
 * Renders nothing for the `normal` role to keep the common case clean.
 */
export function RoleDot({
  role,
  user,
  size = 8,
  forceShow = false,
}: {
  role?: PlazaRole | string | null;
  user?: { plazaRole?: string | null } | null;
  size?: number;
  /** Show the dot even for the 'normal' role (e.g. on profile headers). */
  forceShow?: boolean;
}) {
  const theme = useTheme();
  const r = (role ?? user?.plazaRole ?? 'normal') as PlazaRole;
  if (r === 'normal' && !forceShow) return null;
  return (
    <View
      accessibilityElementsHidden
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: roleColor(theme, r),
      }}
    />
  );
}
