/**
 * Plaza 身份 (identity tier) — Phase 4 spec §9.2.5 / §9.3. Resolves a user to a
 * single identity tier by priority (highest wins):
 *   admin  🟣  platform staff / official account
 *   vip    🟡  active Premium (paid) — Free users never get VIP, whatever level
 *   legend 🏅  Lv20 传奇吹水王 (gold)
 *   old    🔵  Lv10–Lv19 老成员
 *   normal ⚪  Lv2–Lv9 普通用户
 *   new    🟢  Lv1 新人
 *
 * Colors are NOT decided here — the client maps tier → theme token (spec §9.3:
 * "颜色具体色值由设计稿定义，前端使用主题变量管理"). We only return the tier + level.
 *
 * NOTE: the schema has no dedicated `isAdmin` flag; `isOfficial` (bot/support /
 * official accounts) is the closest platform-staff marker, so it drives the
 * admin tier. TODO: add a real isAdmin field if staff ≠ official diverges.
 */
const { isPremiumActive } = require('./premium');
const { levelForXp } = require('../config/xpTable');

/** Effective level: prefer the stored `level`, else derive from currentExp. */
function levelOf(user) {
  if (!user) return 1;
  if (typeof user.level === 'number' && user.level >= 1) return user.level;
  return levelForXp(user.currentExp || 0);
}

/** Identity tier string for a User doc (or toPublicJSON result). */
function tierOf(user) {
  if (!user) return 'new';
  if (user.isOfficial) return 'admin';
  if (isPremiumActive(user)) return 'vip';
  const lvl = levelOf(user);
  if (lvl >= 20) return 'legend';
  if (lvl >= 10) return 'old';
  if (lvl >= 2) return 'normal';
  return 'new';
}

/** { tier, level } — the compact identity payload attached to chat senders + roster. */
function identityOf(user) {
  return { tier: tierOf(user), level: levelOf(user) };
}

module.exports = { levelOf, tierOf, identityOf };
