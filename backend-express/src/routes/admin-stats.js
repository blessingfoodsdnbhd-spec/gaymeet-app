// Admin analytics dashboard (STATS1). A single snapshot of headline metrics.
// Gated by requireAdminAuth (X-Admin-Token OR ADMIN_EMAILS Bearer).
const router = require('express').Router();
const { requireAdminAuth } = require('../middleware/adminAuth');
const { ok } = require('../utils/respond');
const User = require('../models/User');
const Moment = require('../models/Moment');
const VoteEvent = require('../models/VoteEvent');
const Match = require('../models/Match');

router.use(requireAdminAuth);

// ── GET /api/admin/stats ──────────────────────────────────────────────────────
router.get('/stats', async (_req, res, next) => {
  try {
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    const d1 = new Date(now - DAY);
    const d7 = new Date(now - 7 * DAY);
    const d30 = new Date(now - 30 * DAY);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      dau,
      mau,
      signupsToday,
      signups7d,
      signups30d,
      premiumCount,
      moments24h,
      totalMoments,
      totalVotes,
      totalMatches,
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ lastActiveAt: { $gte: d1 } }),
      User.countDocuments({ lastActiveAt: { $gte: d30 } }),
      User.countDocuments({ createdAt: { $gte: startOfToday } }),
      User.countDocuments({ createdAt: { $gte: d7 } }),
      User.countDocuments({ createdAt: { $gte: d30 } }),
      User.countDocuments({ $or: [{ isPremium: true }, { vipLevel: { $gt: 0 } }] }),
      Moment.countDocuments({ createdAt: { $gte: d1 } }),
      Moment.countDocuments({}),
      VoteEvent.countDocuments({}),
      Match.countDocuments({}),
    ]);

    const premiumPct = totalUsers ? Math.round((premiumCount / totalUsers) * 1000) / 10 : 0;

    ok(res, {
      totalUsers,
      dau,
      mau,
      signupsToday,
      signups7d,
      signups30d,
      premiumCount,
      premiumPct,
      moments24h,
      totalMoments,
      totalVotes,
      totalMatches,
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
