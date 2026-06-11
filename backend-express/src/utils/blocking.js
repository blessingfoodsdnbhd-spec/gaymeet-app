// Centralized block-list resolution. Blocking is stored as an embedded array
// `blockedUsers` on the User model (see models/User.js). The `auth` middleware
// already loads the full user, so the OUTGOING list (`user.blockedUsers`) is
// free; the INCOMING list ("who blocked me") needs one indexed query.
//
// We enforce MUTUAL (symmetric) blocking — WhatsApp/IG model: once A blocks B,
// neither sees the other anywhere. Every read endpoint should exclude this set;
// write paths between two users should refuse if either side blocked the other.
//
// This generalizes the inline pattern previously duplicated in routes/topics.js,
// routes/discover.js and routes/users.js — those should consume this helper.
const User = require('../models/User');

/**
 * Set<string> of user ids the viewer must never see — anyone they blocked OR
 * who blocked them. Ids are stringified for cheap membership tests.
 * @param {{ _id: any, blockedUsers?: any[] }} user  the authenticated user (req.user)
 */
async function blockedIdSet(user) {
  if (!user || !user._id) return new Set();
  const incoming = await User.find({ blockedUsers: user._id }, { _id: 1 }).lean();
  return new Set([
    ...(user.blockedUsers || []).map(String),
    ...incoming.map((u) => String(u._id)),
  ]);
}

/**
 * Array of ids suitable for a Mongo `$nin`. Pass a pre-built set to avoid
 * re-querying when you already resolved it.
 */
async function blockedIdArray(user, set) {
  return [...(set || (await blockedIdSet(user)))];
}

/**
 * True when the viewer and `otherId` are blocked in either direction. Use on
 * write paths (send DM, follow, open chat, send note) to refuse the action.
 */
async function isBlockedBetween(user, otherId, set) {
  if (!otherId) return false;
  const s = set || (await blockedIdSet(user));
  return s.has(String(otherId));
}

module.exports = { blockedIdSet, blockedIdArray, isBlockedBetween };
