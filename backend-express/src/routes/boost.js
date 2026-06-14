const router = require('express').Router();
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { ok, err } = require('../utils/respond');
const { isPremiumActive } = require('../utils/premium');
const { COIN_REWARDS } = require('../utils/coins');

// ── POST /api/users/boost ─────────────────────────────────────────────────────
// Premium users boost free; everyone else pays COIN_REWARDS.boostCost (50) coins.
// Both give 30 min at the top of Discover.
router.post('/boost', auth, async (req, res, next) => {
  try {
    const me = req.user;

    if (me.isBoosted && me.boostExpiresAt && new Date() < me.boostExpiresAt) {
      return err(res, 'Boost already active');
    }

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min

    if (isPremiumActive(me)) {
      await User.findByIdAndUpdate(me._id, { isBoosted: true, boostExpiresAt: expiresAt });
      return ok(res, { isBoosted: true, boostExpiresAt: expiresAt.toISOString(), cost: 0 });
    }

    // Non-Premium: charge coins atomically (the $gte filter is the race guard so
    // two taps can't both spend from the same balance).
    const cost = COIN_REWARDS.boostCost;
    const updated = await User.findOneAndUpdate(
      { _id: me._id, coins: { $gte: cost } },
      { $inc: { coins: -cost }, $set: { isBoosted: true, boostExpiresAt: expiresAt } },
      { new: true, projection: 'coins' },
    );
    if (!updated) {
      return err(res, 'Insufficient coins', 402);
    }

    ok(res, { isBoosted: true, boostExpiresAt: expiresAt.toISOString(), cost, balance: updated.coins });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
