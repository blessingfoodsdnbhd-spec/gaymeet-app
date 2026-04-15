const router = require('express').Router();
const User = require('../models/User');
const Match = require('../models/Match');
const GiftTransaction = require('../models/GiftTransaction');
const Energy = require('../models/Energy');
const Follow = require('../models/Follow');
const { auth } = require('../middleware/auth');
const { ok } = require('../utils/respond');

// ── POST /api/notifications/token ─────────────────────────────────────────────
router.post('/token', auth, async (req, res, next) => {
  try {
    const { token } = req.body;
    if (token) {
      await User.findByIdAndUpdate(req.user._id, { fcmToken: token });
    }
    ok(res, { success: true });
  } catch (e) {
    next(e);
  }
});

// ── DELETE /api/notifications/token ──────────────────────────────────────────
router.delete('/token', auth, async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { fcmToken: null });
    ok(res, { success: true });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/notifications/schedule ─────────────────────────────────────────
router.post('/schedule', auth, async (req, res, next) => {
  try {
    ok(res, { queued: true });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/notifications ────────────────────────────────────────────────────
// Aggregated recent activity for the current user.
// Returns up to 50 items sorted newest-first, typed for client rendering.
router.get('/', auth, async (req, res, next) => {
  try {
    const uid = req.user._id;
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // last 30 days

    const [matches, gifts, energies, follows] = await Promise.all([
      // New matches
      Match.find({ users: uid, isActive: true, createdAt: { $gte: since } })
        .sort({ createdAt: -1 })
        .limit(20)
        .populate({ path: 'users', select: 'nickname avatarUrl', match: { _id: { $ne: uid } } })
        .lean(),

      // Gifts received
      GiftTransaction.find({ receiver: uid, createdAt: { $gte: since } })
        .sort({ createdAt: -1 })
        .limit(20)
        .populate('sender', 'nickname avatarUrl')
        .populate('gift', 'name iconUrl')
        .lean(),

      // Energy received
      Energy.find({ receiver: uid, createdAt: { $gte: since } })
        .sort({ createdAt: -1 })
        .limit(20)
        .populate('sender', 'nickname avatarUrl')
        .lean(),

      // New followers
      Follow.find({ following: uid, createdAt: { $gte: since } })
        .sort({ createdAt: -1 })
        .limit(20)
        .populate('follower', 'nickname avatarUrl')
        .lean(),
    ]);

    const notifications = [
      ...matches.map((m) => ({
        type: 'match',
        id: m._id,
        user: m.users?.find((u) => u),
        createdAt: m.createdAt,
      })),
      ...gifts.map((g) => ({
        type: 'gift',
        id: g._id,
        user: g.sender,
        gift: g.gift,
        createdAt: g.createdAt,
      })),
      ...energies.map((e) => ({
        type: 'energy',
        id: e._id,
        user: e.sender,
        amount: e.amount,
        createdAt: e.createdAt,
      })),
      ...follows.map((f) => ({
        type: 'follow',
        id: f._id,
        user: f.follower,
        createdAt: f.createdAt,
      })),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 50);

    ok(res, notifications);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
