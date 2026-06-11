/**
 * Plaza 身份 + 等级 presentation helpers (spec §9.2 / §9.3). The backend sends a
 * compact `identity: { tier, level }` on chat senders + roster entries; this maps
 * a tier to its theme color + emoji badge, and resolves level titles. Colors live
 * in the design system (tokens.ts `tier*`) so they stay themeable.
 */
import type { Theme } from '../theme/ThemeProvider';
import type { PlazaTier, WorldChatRoom } from '../api/worldChat';

type TFn = (key: string, opts?: Record<string, unknown>) => string;

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

/**
 * Prefix a country sub-board name with its country so it reads unambiguously
 * everywhere it's shown alone (热门 list, room header): 中文 glues tight
 * ("马来西亚总聊天室"), other locales space-separate ("Malaysia General Chat").
 */
export function prefixCountrySub(isZh: boolean, countryName: string, subName: string): string {
  return isZh ? `${countryName}${subName}` : `${countryName} ${subName}`;
}

/**
 * Display name for any Plaza room. Topic/interest/sub-board rooms resolve their
 * name via i18nKey (localized to all 4 languages), else fall back to the label.
 * Country sub-boards get their parent country prefixed (see prefixCountrySub).
 */
export function plazaRoomName(room: WorldChatRoom, t: TFn, isZh: boolean): string {
  const base = room.i18nKey
    ? t(room.i18nKey, { defaultValue: isZh ? room.label.zh : room.label.en })
    : isZh
      ? room.label.zh
      : room.label.en;
  if (room.kind === 'country-sub' && room.countryLabel) {
    return prefixCountrySub(isZh, isZh ? room.countryLabel.zh : room.countryLabel.en, base);
  }
  return base;
}
