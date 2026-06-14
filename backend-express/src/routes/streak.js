const router = require('express').Router();
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { ok } = require('../utils/respond');
const { touchStreak, coinReward } = require('../utils/streak');

// ── GET /api/streak ───────────────────────────────────────────────────────────
// Current daily-login streak status for the check-in modal. The auth middleware
// already fires touchStreak() fire-and-forget; we await it here too (idempotent,
// once-per-day guarded) so the value we read back reflects today before the
// client renders the celebration.
router.get('/', auth, async (req, res, next) => {
  try {
    await touchStreak(req.user);
    const u = await User.findById(req.user._id).select('streak coins').lean();
    const current = u?.streak?.current ?? 0;
    ok(res, {
      current,
      longest: u?.streak?.longest ?? 0,
      lastActiveDate: u?.streak?.lastActiveDate ?? null,
      coins: u?.coins ?? 0,
      todayReward: coinReward(current), // coins this day's login granted
      milestones: [1, 3, 7, 30],
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
