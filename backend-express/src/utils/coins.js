// Coin economy (Phase 4). Central reward amounts + a safe award helper so every
// earn-source credits the same way and we have one place to tune the economy.
const User = require('../models/User');

const COIN_REWARDS = {
  referralInviter: 100, // you invited a friend who joined
  referralInvitee: 50, // you joined via an invite
  profileComplete: 50, // one-time: finished your profile
  voteDaily: 5, // first vote of the day
  boostCost: 50, // spend: 30-min Discover boost (non-Premium)
};

/**
 * Credit `amount` coins to a user. Never throws (gamification must not break the
 * caller). Returns the new balance, or 0 on error.
 */
async function awardCoins(userId, amount) {
  if (!userId || !amount) return 0;
  try {
    const u = await User.findByIdAndUpdate(
      userId,
      { $inc: { coins: amount } },
      { new: true, projection: 'coins' },
    );
    return u?.coins ?? 0;
  } catch (_) {
    return 0;
  }
}

/**
 * Server-side sanity bar for the one-time profile-completion bonus. Deliberately
 * looser than the client's weighted % (which is presentational) — it just blocks
 * claiming on an empty profile.
 */
function isProfileComplete(user) {
  if (!user) return false;
  const photos = Array.isArray(user.photos) ? user.photos.length : 0;
  const interests = Array.isArray(user.interests) ? user.interests.length : 0;
  const hasBio = typeof user.bio === 'string' && user.bio.trim().length >= 10;
  return photos >= 1 && hasBio && interests >= 3;
}

module.exports = { COIN_REWARDS, awardCoins, isProfileComplete };
