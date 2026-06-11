/**
 * Plaza 自建房卡片颜色 / 等级解锁系统 (room card colors, unlocked by level).
 * Each user level Lv1–Lv20 unlocks ONE card background color, in this order.
 * A user may set any room they own to any color they've UNLOCKED (level ≥ the
 * color's level); Premium users can give each of their rooms a different color.
 *
 * Readability rules (enforced in the client): card text stays BLACK (#000),
 * the in-room chat background is ALWAYS white with black text (never tinted),
 * and black is never a selectable card color.
 *
 * Lv19 is metallic silver and Lv20 is gold with a gradient + shimmer — those
 * effects are client-only; the backend just stores/validates the hex.
 */
const PALETTE = [
  { level: 1, hex: '#F5F5F5' }, // 灰白
  { level: 2, hex: '#FFC0CB' }, // 粉
  { level: 3, hex: '#FFA500' }, // 橙
  { level: 4, hex: '#FFEB3B' }, // 黄
  { level: 5, hex: '#A5D6A7' }, // 浅绿
  { level: 6, hex: '#4CAF50' }, // 翠绿
  { level: 7, hex: '#00BCD4' }, // 青
  { level: 8, hex: '#81D4FA' }, // 浅蓝
  { level: 9, hex: '#2196F3' }, // 蓝
  { level: 10, hex: '#1565C0' }, // 深蓝
  { level: 11, hex: '#9C27B0' }, // 紫
  { level: 12, hex: '#C2185B' }, // 紫红
  { level: 13, hex: '#E91E63' }, // 玫红
  { level: 14, hex: '#F44336' }, // 红
  { level: 15, hex: '#B71C1C' }, // 深红
  { level: 16, hex: '#795548' }, // 棕
  { level: 17, hex: '#BCAAA4' }, // 卡其
  { level: 18, hex: '#607D8B' }, // 雾蓝
  { level: 19, hex: '#C0C0C0' }, // 银（金属反光）
  { level: 20, hex: '#FFD700' }, // 金（金箔渐变 + 闪光）
];

const DEFAULT_HEX = PALETTE[0].hex; // Lv1 — everyone has it from registration.
const BY_HEX = new Map(PALETTE.map((p) => [p.hex.toUpperCase(), p]));

/** The level a hex unlocks at, or null if it isn't a palette color. */
function levelForHex(hex) {
  const p = BY_HEX.get(String(hex || '').toUpperCase());
  return p ? p.level : null;
}

/** True when `hex` is a valid palette color the given user level has unlocked. */
function isUnlocked(hex, userLevel) {
  const need = levelForHex(hex);
  return need != null && (Number(userLevel) || 1) >= need;
}

module.exports = { PALETTE, DEFAULT_HEX, levelForHex, isUnlocked };
