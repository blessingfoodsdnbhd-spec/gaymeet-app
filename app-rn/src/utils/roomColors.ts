/**
 * Plaza 自建房卡片颜色 / 等级解锁系统 (room card colors). Mirrors the backend
 * config/roomColors PALETTE: each level Lv1–Lv20 unlocks ONE card background
 * color. The create/edit picker shows unlocked colors as selectable and locked
 * ones greyed-out with their required level.
 *
 * Readability (spec): card text is ALWAYS black (CARD_TEXT) and the in-room chat
 * background is always white — the card color never tints the chat. Black is
 * never a selectable card color.
 */
export interface RoomColor {
  level: number;
  hex: string;
}

export const PALETTE: RoomColor[] = [
  { level: 1, hex: '#F5F5F5' },
  { level: 2, hex: '#FFC0CB' },
  { level: 3, hex: '#FFA500' },
  { level: 4, hex: '#FFEB3B' },
  { level: 5, hex: '#A5D6A7' },
  { level: 6, hex: '#4CAF50' },
  { level: 7, hex: '#00BCD4' },
  { level: 8, hex: '#81D4FA' },
  { level: 9, hex: '#2196F3' },
  { level: 10, hex: '#1565C0' },
  { level: 11, hex: '#9C27B0' },
  { level: 12, hex: '#C2185B' },
  { level: 13, hex: '#E91E63' },
  { level: 14, hex: '#F44336' },
  { level: 15, hex: '#B71C1C' },
  { level: 16, hex: '#795548' },
  { level: 17, hex: '#BCAAA4' },
  { level: 18, hex: '#607D8B' },
  { level: 19, hex: '#C0C0C0' }, // 银 — metallic gradient
  { level: 20, hex: '#FFD700' }, // 金 — gold gradient + shimmer
];

export const DEFAULT_HEX = PALETTE[0].hex; // Lv1 灰白
/** Card name + count text — always black per the readability rules. */
export const CARD_TEXT = '#000000';

const SILVER_HEX = '#C0C0C0';
const GOLD_HEX = '#FFD700';

const byHex = new Map(PALETTE.map((p) => [p.hex.toUpperCase(), p]));

export function levelForHex(hex: string): number | null {
  return byHex.get((hex || '').toUpperCase())?.level ?? null;
}

export function isUnlocked(hex: string, userLevel: number): boolean {
  const need = levelForHex(hex);
  return need != null && (userLevel || 1) >= need;
}

/** Gradient stops for the metallic tiers (银/金), or null for a solid color. */
export function gradientFor(hex: string): readonly string[] | null {
  const up = (hex || '').toUpperCase();
  if (up === GOLD_HEX) return ['#FFE680', '#FFD700', '#E6B800', '#FFD700'] as const; // 金箔渐变
  if (up === SILVER_HEX) return ['#EDEDED', '#C0C0C0', '#9E9E9E', '#D8D8D8'] as const; // 金属反光
  return null;
}

/** Lv20 gold gets an animated shimmer sweep. */
export function isShimmer(hex: string): boolean {
  return (hex || '').toUpperCase() === GOLD_HEX;
}
