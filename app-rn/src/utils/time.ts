import i18n from '../i18n';

/** Format a Date or ISO string as a short relative time, localized. */
export function shortTime(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return i18n.t('time.justNow');
  if (diffMin < 60) return i18n.t('time.minAgo', { n: diffMin });
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return i18n.t('time.hrAgo', { n: diffHr });
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return i18n.t('time.dayAgo', { n: diffDay });
  // Older than a week — use the device locale's short date.
  const locale = i18n.language?.startsWith('zh') ? 'zh-CN' : 'en-US';
  return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

export function hhmm(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const locale = i18n.language?.startsWith('zh') ? 'zh-CN' : 'en-US';
  return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false });
}
