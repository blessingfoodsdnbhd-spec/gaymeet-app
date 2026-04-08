const router = require('express').Router();
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { ok, err } = require('../utils/respond');

// ── POST /api/users/boost ─────────────────────────────────────────────────────
router.post('/boost', auth, async (req, res, next) => {
  try {
    const me = req.user;

    if (!me.isPremium) {
      return err(res, 'Boost requires Premium', 403);
    }

    if (me.isBoosted && me.boostExpiresAt && new Date() < me.boostExpiresAt) {
      return err(res, 'Boost already active');
    }

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min
    await User.findByIdAndUpdate(me._id, {
      isBoosted: true,
      boostExpiresAt: expiresAt,
    });

    ok(res, { isBoosted: true, boostExpiresAt: expiresAt.toISOString() });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
