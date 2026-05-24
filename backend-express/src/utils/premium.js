/**
 * Canonical "is this user currently premium" check.
 *
 * Use this everywhere gating premium-only features. Replaces the prior
 * scatter of patterns:
 *   - `me.isPremium` (raw field — IGNORED expiry, used in swipes / likes
 *      / boost; let expired-premium users keep features until /status
 *      was polled)
 *   - `isPremium || vipLevel > 0` (questions.js — IGNORED expiry on
 *      either branch)
 *   - inline `vipActive || isPremium+expiry` (direct-messages — correct
 *      but copy/pasted)
 *   - local `isPremiumActive` helper in conversations.js — correct,
 *      hoisted here.
 *
 * A user counts as premium if EITHER:
 *   - `vipLevel > 0` and (`vipExpiresAt` is null OR in the future), OR
 *   - `isPremium` is true and (`premiumExpiresAt` is null OR in the future).
 *
 * Null expiry = "doesn't expire" (used for seed users / lifetime grants).
 *
 * @param {object} user - a User document or its toPublicJSON() result
 * @returns {boolean}
 */
function isPremiumActive(user) {
  if (!user) return false;
  const now = new Date();
  if (user.vipLevel > 0) {
    if (!user.vipExpiresAt || new Date(user.vipExpiresAt) > now) return true;
  }
  if (user.isPremium) {
    if (!user.premiumExpiresAt || new Date(user.premiumExpiresAt) > now) return true;
  }
  return false;
}

module.exports = { isPremiumActive };
