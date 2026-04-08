const router = require('express').Router();
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { ok, err } = require('../utils/respond');

// ── GET /api/popular ──────────────────────────────────────────────────────────
// Returns top users by profile views/likes in a given country.
// We approximate popularity by: isPremium > isBoosted > lastActiveAt,
// and add a `rank` and `ticketCount` field.
router.get('/', auth, async (req, res, next) => {
  try {
    const { countryCode } = req.query;
    const me = req.user;

    const filter = {
      _id: { $ne: me._id },
      'preferences.hideFromNearby': { $ne: true },
      'preferences.stealthMode': { $ne: true },
    };
    if (countryCode) filter.countryCode = countryCode;

    const users = await User.find(filter)
      .sort({ isBoosted: -1, isPremium: -1, lastActiveAt: -1 })
      .limit(50)
      .select('nickname avatarUrl countryCode isBoosted isPremium lastActiveAt age height')
      .lean();

    const result = users.map((u, i) => ({
      rank: i + 1,
      userId: u._id,
      nickname: u.nickname,
      avatarUrl: u.avatarUrl,
      countryCode: u.countryCode,
      isBoosted: u.isBoosted,
      isPremium: u.isPremium,
      age: u.age,
      height: u.height,
      // Simulated ticket count
      ticketCount: Math.max(0, 100 - i * 2),
    }));

    ok(res, result);
  } catch (e) {
    next(e);
  }
});

// ── POST /api/popular/ticket/use ──────────────────────────────────────────────
router.post('/ticket/use', auth, async (req, res, next) => {
  try {
    const { countryCode } = req.body;
    // In production: decrement ticket balance from a Ticket collection.
    // Here we acknowledge and return updated mock balance.
    ok(res, { success: true, countryCode, remaining: 4 });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/popular/ticket/purchase ─────────────────────────────────────────
router.post('/ticket/purchase', auth, async (req, res, next) => {
  try {
    if (!req.user.isPremium) {
      return err(res, 'Ticket purchase requires Premium', 403);
    }
    ok(res, { success: true, purchased: 5, total: 5 });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
