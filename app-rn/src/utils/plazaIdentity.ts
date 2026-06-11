/**
 * Plaza 身份 + 等级 presentation helpers (spec §9.2 / §9.3). The backend sends a
 * compact `identity: { tier, level }` on chat senders + roster entries; this maps
 * a tier to its theme color + emoji badge, and resolves level titles. Colors live
 * in the design system (tokens.ts `tier*`) so they stay themeable.
 */
import type { Theme } from '../theme/ThemeProvider';
import type { PlazaTier } from '../api/worldChat';

/** Tier → theme color token (spec §9.3). */
export function tierColor(theme: Theme, tier: PlazaTier | undefined): string {
  switch (tier) {
    case 'admin':
      return theme.colors.tierAdmin;
    case 'vip':
      return theme.colors.tierVip;
    case 'legend':
      return theme.colors.tierLegend;
    case 'old':
      return theme.colors.tierOld;
    case 'new':
      return theme.colors.tierNew;
    case 'normal':
    default:
      return theme.colors.tierNormal;
  }
}

/** Tier → the leading emoji dot shown before a username (spec §9.1 example). */
export function tierEmoji(tier: PlazaTier | undefined): string {
  switch (tier) {
    case 'admin':
      return '🟣';
    case 'vip':
      return '🟡';
    case 'legend':
      return '🏅';
    case 'old':
      return '🔵';
    case 'new':
      return '🟢';
    case 'normal':
    default:
      return '⚪';
  }
}

/** i18n key for a level's title, or null for levels with no special title. */
export function levelTitleKey(level: number): string | null {
  if (level >= 20) return 'plaza.level.title.lv20';
  if (level >= 10) return 'plaza.level.title.lv10';
  if (level >= 5) return 'plaza.level.title.lv5';
  if (level <= 1) return 'plaza.level.title.lv1';
  return null;
}

/**
 * Canonical room id for a country sub-board. Mirrors the backend's subChannelId:
 * 世界大厅's 总聊天室 keeps the legacy 'world' id; everything else is namespaced.
 */
export function subBoardRoomId(countryCode: string, key: string): string {
  if (countryCode === 'world' && key === 'general') return 'world';
  return `country:${countryCode.toLowerCase()}:${key}`;
}
