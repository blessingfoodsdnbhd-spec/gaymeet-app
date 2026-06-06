const User = require('../models/User');

/**
 * Extend a user's Premium (VIP) by `ms` milliseconds. Stacks on top of any
 * existing future expiry (max(now, current) + ms) and ensures vipLevel is at
 * least 3 (the all-features tier). Returns the new expiry Date, or null if the
 * user wasn't found.
 */
async function grantPremiumMs(userId, ms) {
  const u = await User.findById(userId).select('vipLevel vipExpiresAt');
  if (!u) return null;
  const now = Date.now();
  const base = u.vipExpiresAt && u.vipExpiresAt.getTime() > now ? u.vipExpiresAt.getTime() : now;
  const next = new Date(base + ms);
  const set = { vipExpiresAt: next };
  if (!(u.vipLevel > 0)) set.vipLevel = 3;
  else if (u.vipLevel < 3) set.vipLevel = 3;
  await User.updateOne({ _id: userId }, { $set: set });
  return next;
}

module.exports = { grantPremiumMs };
