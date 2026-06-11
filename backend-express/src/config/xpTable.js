/**
 * Plaza 用户等级体系 (XP / level system) — Phase 4 spec §9.2. Static, definitive
 * table; the backend uses a table lookup (no runtime curve math). XP[i] = the
 * cumulative XP required to REACH level (i+1). Index 0 = Lv1 = 0 XP.
 */

// Cumulative XP to reach each level. Lv1..Lv20 (spec §9.2.4, defrosted values).
const LEVEL_XP = [
  0, // Lv1
  60, // Lv2
  150, // Lv3
  290, // Lv4
  500, // Lv5  — 常客
  700, // Lv6
  1000, // Lv7
  1450, // Lv8
  2100, // Lv9
  3000, // Lv10 — 资深成员
  3900, // Lv11
  5000, // Lv12
  6400, // Lv13
  8000, // Lv14
  10000, // Lv15 — 里程碑
  12000, // Lv16
  14700, // Lv17
  18300, // Lv18
  23300, // Lv19
  30000, // Lv20 — 传奇吹水王
];

const MAX_LEVEL = LEVEL_XP.length; // 20

// Title shown at the named milestone levels (spec §9.2.1). Unnamed levels
// resolve to null (UI shows just "Lv N").
const LEVEL_TITLES = {
  1: 'plaza.level.title.lv1', // 新人
  5: 'plaza.level.title.lv5', // 常客
  10: 'plaza.level.title.lv10', // 资深成员
  20: 'plaza.level.title.lv20', // 传奇吹水王
};

/** Level (1..20) for a cumulative XP total. */
function levelForXp(totalXp) {
  const xp = Math.max(0, Number(totalXp) || 0);
  let lvl = 1;
  for (let i = 0; i < LEVEL_XP.length; i++) {
    if (xp >= LEVEL_XP[i]) lvl = i + 1;
    else break;
  }
  return lvl;
}

/** i18nKey of a level's title, or null when the level has no special title. */
function titleKeyForLevel(level) {
  return LEVEL_TITLES[level] || null;
}

/** Progress within the current level: { level, into, span, nextXp }. */
function levelProgress(totalXp) {
  const xp = Math.max(0, Number(totalXp) || 0);
  const level = levelForXp(xp);
  const floor = LEVEL_XP[level - 1] ?? 0;
  const ceil = LEVEL_XP[level] ?? null; // null at max level
  return {
    level,
    into: xp - floor,
    span: ceil != null ? ceil - floor : 0,
    nextXp: ceil,
  };
}

module.exports = { LEVEL_XP, MAX_LEVEL, LEVEL_TITLES, levelForXp, titleKeyForLevel, levelProgress };
