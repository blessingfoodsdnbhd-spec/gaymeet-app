const router = require('express').Router();
const Match = require('../models/Match');
const Message = require('../models/Message');
const { auth } = require('../middleware/auth');
const { ok, err } = require('../utils/respond');

// ── GET /api/matches ──────────────────────────────────────────────────────────
router.get('/', auth, async (req, res, next) => {
  try {
    const matches = await Match.find({
      users: req.user._id,
      isActive: true,
    })
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .populate(
        'users',
        'nickname avatarUrl isOnline lastActiveAt isPremium isBoosted countryCode'
      )
      .lean();

    // Attach the other user and unread count for each match
    const result = matches.map((m) => {
      const other = m.users.find(
        (u) => u._id.toString() !== req.user._id.toString()
      );
      const unread = m.unreadCounts?.get
        ? (m.unreadCounts.get(req.user._id.toString()) || 0)
        : (m.unreadCounts?.[req.user._id.toString()] || 0);

      return {
        ...m,
        otherUser: other,
        unreadCount: unread,
      };
    });

    ok(res, result);
  } catch (e) {
    next(e);
  }
});

// ── GET /api/matches/:matchId/messages ────────────────────────────────────────
router.get('/:matchId/messages', auth, async (req, res, next) => {
  try {
    const match = await Match.findOne({
      _id: req.params.matchId,
      users: req.user._id,
    });
    if (!match) return err(res, 'Match not found', 404);

    const { before, limit = 50 } = req.query;
    const query = { matchId: match._id };
    if (before) query.createdAt = { $lt: new Date(before) };

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();

    ok(res, messages.reverse());
  } catch (e) {
    next(e);
  }
});

// ── DELETE /api/matches/:matchId ──────────────────────────────────────────────
router.delete('/:matchId', auth, async (req, res, next) => {
  try {
    const match = await Match.findOne({
      _id: req.params.matchId,
      users: req.user._id,
    });
    if (!match) return err(res, 'Match not found', 404);

    match.isActive = false;
    await match.save();

    ok(res, { success: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
