// Plaza role — a visual hierarchy badge derived entirely from existing user
// data (no new field stored). Surfaced as `plazaRole` in User.toPublicJSON and
// as `role` on each Plaza message author, so the client can render a colored
// dot next to a name. See app-rn/src/components/RoleDot.tsx for the color map.
//
// NOTE: the staff signal is `isOfficial` — this project has no `isAdmin`
// field (the User.role field is the unrelated sexual-role *preference*).

const { isPremiumActive } = require('./premium');

const NEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // < 7 days old → 新人
const VETERAN_LEVEL = 10; // level ≥ 10 → 老成员

/**
 * Compute a user's Plaza role from a (possibly lean) user document.
 * Accepts either a Mongoose doc or a plain object with the relevant fields.
 * @returns {'admin'|'vip'|'veteran'|'new'|'normal'}
 */
function computeRole(user) {
  if (!user) return 'normal';
  if (user.isOfficial) return 'admin';
  if (isPremiumActive(user)) return 'vip';
  if ((user.level || 0) >= VETERAN_LEVEL) return 'veteran';
  const created = user.createdAt ? new Date(user.createdAt).getTime() : null;
  if (created && Date.now() - created < NEW_WINDOW_MS) return 'new';
  return 'normal';
}

module.exports = { computeRole };
