// Presence label from a user's lastActiveAt + isOnline.
//
// Buckets (per spec):
//   online (isOnline, or active < 5 min) → green dot + "在线 / Online"
//   5–60 min   → "X 分钟前活跃"
//   1–24 h     → "X 小时前活跃"
//   > 24 h     → "X 天前活跃"
//   no data    → null (caller renders nothing, or a "hidden" hint)
//
// i18n keys live under `presence.*`. Returns { online, text } or null.

import type { TFunction } from 'i18next';

export interface Presence {
  online: boolean;
  text: string;
}

export function presenceFrom(
  t: TFunction,
  lastActiveAt?: string | null,
  isOnline?: boolean,
): Presence | null {
  if (isOnline) return { online: true, text: t('presence.online') };
  if (!lastActiveAt) return null;
  const then = new Date(lastActiveAt).getTime();
  if (isNaN(then)) return null;

  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 0) return { online: true, text: t('presence.online') };
  if (mins < 5) return { online: true, text: t('presence.online') };
  if (mins < 60) return { online: false, text: t('presence.minsAgo', { n: mins }) };

  const hours = Math.floor(mins / 60);
  if (hours < 24) return { online: false, text: t('presence.hoursAgo', { n: hours }) };

  const days = Math.floor(hours / 24);
  return { online: false, text: t('presence.daysAgo', { n: days }) };
}
