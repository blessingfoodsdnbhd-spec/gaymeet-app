// Lightweight, non-blocking scam/phishing heuristics for chat (item 11). The
// goal is a SOFT flag — surface a caution to the recipient + queue for admin
// review — not censorship. Keep patterns conservative to limit false positives.

// Off-platform contact handles + money/crypto cues. Word-ish boundaries where it
// helps; CJK terms matched as substrings.
const PATTERNS = [
  { key: 'offPlatform', re: /\b(whats\s?app|wechat|we\s?chat|telegram|tele\s?gram|\bline\s?id\b|kakao|signal app|viber|snapchat|@gmail|@outlook|@hotmail)\b/i },
  { key: 'offPlatformCjk', re: /(微信|加微|威信|薇信|电报|电报群|телеграм|line号|加我)/i },
  { key: 'money', re: /\b(wire transfer|western union|paypal me|paypal\.me|gift card|bank transfer|crypto|bitcoin|\bbtc\b|\busdt\b|\beth\b|binance|investment)\b/i },
  { key: 'moneyCjk', re: /(转账|汇款|打款|投资|理财|返利|刷单|博彩|虚拟货币|比特币|泰达币|充值|代付)/i },
];

/**
 * Scan a message body. Returns { flagged, reason } where reason is a short
 * comma-joined list of matched categories (or null). Never throws.
 */
function scanScam(text) {
  if (!text || typeof text !== 'string') return { flagged: false, reason: null };
  const hits = [];
  for (const p of PATTERNS) {
    if (p.re.test(text)) hits.push(p.key);
  }
  if (!hits.length) return { flagged: false, reason: null };
  // De-dupe the *_cjk vs base category so the reason reads cleanly.
  const cats = new Set(hits.map((k) => k.replace(/Cjk$/, '')));
  return { flagged: true, reason: Array.from(cats).join(',') };
}

module.exports = { scanScam };
