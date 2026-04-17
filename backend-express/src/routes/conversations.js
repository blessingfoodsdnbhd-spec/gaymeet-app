const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { ok, err } = require('../utils/respond');
const Match = require('../models/Match');
const Message = require('../models/Message');
const User = require('../models/User');

const FIRST_MESSAGE_COST = 10;

// ── GET /api/conversations ─────────────────────────────────────────────────────
// List all conversations (mutual matches + dm-opened), formatted for MatchModel.fromJson
router.get('/', auth, async (req, res, next) => {
  try {
    const matches = await Match.find({
      users: req.user._id,
      isActive: true,
    })
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .populate(
        'users',
        'nickname avatarUrl isOnline lastActiveAt isPremium isBoosted countryCode isVerified'
      )
      .lean();

    const result = matches
      .map((m) => {
        // populate() returns null for deleted/missing users — skip those slots
        const validUsers = m.users.filter(Boolean);
        const other = validUsers.find(
          (u) => u._id.toString() !== req.user._id.toString()
        );

        // Skip conversations where the other user no longer exists
        if (!other) return null;

        const unread = m.unreadCounts?.[req.user._id.toString()] || 0;

        return {
          matchId: m._id.toString(),
          matchedAt: m.createdAt.toISOString(),
          user: {
            id: other._id.toString(),
            nickname: other.nickname,
            avatarUrl: other.avatarUrl ?? null,
            isOnline: other.isOnline ?? false,
            isPremium: other.isPremium ?? false,
            isBoosted: other.isBoosted ?? false,
            isVerified: other.isVerified ?? false,
            countryCode: other.countryCode ?? null,
          },
          lastMessage: m.lastMessage ?? null,
          lastMessageAt: m.lastMessageAt ? m.lastMessageAt.toISOString() : null,
          unreadCount: unread,
          source: m.source ?? 'match',
        };
      })
      .filter(Boolean); // remove nulls from skipped entries

    ok(res, result);
  } catch (e) {
    next(e);
  }
});

// ── POST /api/conversations/open/:userId ───────────────────────────────────────
// Find existing conversation or create one (charging coins if not a mutual match).
// Returns { matchId, coinsCharged }
router.post('/open/:userId', auth, async (req, res, next) => {
  try {
    const senderId = req.user._id.toString();
    const { userId: targetUserId } = req.params;

    if (senderId === targetUserId) {
      return err(res, 'Cannot open a conversation with yourself', 400);
    }

    const receiver = await User.findById(targetUserId).select('_id nickname');
    if (!receiver) return err(res, 'User not found', 404);

    // Check if a conversation already exists (mutual match OR previous dm)
    const existing = await Match.findOne({
      users: { $all: [senderId, targetUserId] },
      isActive: true,
    });

    if (existing) {
      return ok(res, { matchId: existing._id.toString(), coinsCharged: 0 });
    }

    // No conversation yet — charge coins to open one
    if (req.user.coins < FIRST_MESSAGE_COST) {
      return err(
        res,
        `Insufficient coins. Need ${FIRST_MESSAGE_COST} coins to start a conversation.`,
        402
      );
    }

    await User.findByIdAndUpdate(senderId, {
      $inc: { coins: -FIRST_MESSAGE_COST },
    });

    const match = await Match.create({
      users: [senderId, targetUserId],
      source: 'dm',
    });

    ok(res, { matchId: match._id.toString(), coinsCharged: FIRST_MESSAGE_COST }, 201);
  } catch (e) {
    next(e);
  }
});

// ── GET /api/conversations/:userId/messages ────────────────────────────────────
// Message history with a specific user (by their userId, not matchId)
router.get('/:userId/messages', auth, async (req, res, next) => {
  try {
    const match = await Match.findOne({
      users: { $all: [req.user._id, req.params.userId] },
      isActive: true,
    });

    if (!match) return ok(res, []);

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

module.exports = router;
