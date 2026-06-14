// Date-divider formatting for chat lists (private DM + Plaza/World chat).
// Mirrors WhatsApp / iMessage day separators, Chinese locale.
//
//   today          → 今天
//   yesterday      → 昨天
//   within 7 days  → 星期X (weekday)
//   older          → 2026年6月12日 (Y年M月D日)

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

const DAY_MS = 86_400_000;

/** Localized label for a message's calendar day. */
export function formatChatDate(d: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - DAY_MS);
  // Boundary for "this week": anything strictly after (today − 7 days) shows a
  // weekday name; today/yesterday are handled above.
  const weekAgo = new Date(today.getTime() - 7 * DAY_MS);
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (target.getTime() === today.getTime()) return '今天';
  if (target.getTime() === yesterday.getTime()) return '昨天';
  if (target.getTime() > weekAgo.getTime()) return WEEKDAYS[d.getDay()];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/** True when `current` falls on a different calendar day than `prev` (or there
 *  is no previous message), i.e. a date divider should precede `current`. */
export function shouldShowDateDivider(prev: Date | null, current: Date): boolean {
  if (!prev) return true;
  return prev.toDateString() !== current.toDateString();
}
