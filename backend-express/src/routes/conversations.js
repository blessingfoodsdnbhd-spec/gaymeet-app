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
// Find existing conversation or create one. Opening a dm with someone you
// haven't matched yet charges FIRST_MESSAGE_COST coins from User.coins;
// already-matched users open for free.
//
// Returns:
//   200 { matchId, coinsCharged: 0 }     — existing match / chat
//   201 { matchId, coinsCharged: 10 }    — newly opened dm, coins deducted
//   402 { error, required, balance }     — insufficient coins
router.post('/open/:userId', auth, async (req, res, next) => {
  try {
    const senderId = req.user._id.toString();
    const { userId: targetUserId } = req.params;

    if (senderId === targetUserId) {
      return err(res, 'Cannot open a conversation with yourself', 400);
    }

    const receiver = await User.findById(targetUserId).select('_id nickname');
    if (!receiver) return err(res, 'User not found', 404);

    // Existing match / chat: free
    const existing = await Match.findOne({
      users: { $all: [senderId, targetUserId] },
      isActive: true,
    });
    if (existing) {
      return ok(res, { matchId: existing._id.toString(), coinsCharged: 0 });
    }

    // New dm: charge intro fee from the sender's coin balance.
    const balance = req.user.coins ?? 0;
    if (balance < FIRST_MESSAGE_COST) {
      return res.status(402).json({
        error: '金币不足',
        required: FIRST_MESSAGE_COST,
        balance,
      });
    }

    // Atomic decrement + create — if either fails, roll back the decrement.
    const updated = await User.findOneAndUpdate(
      { _id: senderId, coins: { $gte: FIRST_MESSAGE_COST } },
      { $inc: { coins: -FIRST_MESSAGE_COST } },
      { new: true },
    );
    if (!updated) {
      return res.status(402).json({
        error: '金币不足',
        required: FIRST_MESSAGE_COST,
        balance,
      });
    }

    try {
      const match = await Match.create({
        users: [senderId, targetUserId],
        source: 'dm',
      });
      return ok(
        res,
        {
          matchId: match._id.toString(),
          coinsCharged: FIRST_MESSAGE_COST,
          balance: updated.coins,
        },
        201,
      );
    } catch (createErr) {
      // Refund on failure
      await User.findByIdAndUpdate(senderId, {
        $inc: { coins: FIRST_MESSAGE_COST },
      });
      throw createErr;
    }
  } catch (e) {
    next(e);
  }
});

// ── POST /api/conversations/:matchId/send ─────────────────────────────────────
// HTTP fallback for sending a message (used when socket is disconnected).
// Also emits via Socket.io so the receiver gets real-time delivery if online.
router.post('/:matchId/send', auth, async (req, res, next) => {
  try {
    const { content, type = 'text' } = req.body;
    if (!content?.trim()) return err(res, 'content required', 400);
    if (content.length > 2000) return err(res, 'message too long', 400);

    const match = await Match.findOne({
      _id: req.params.matchId,
      users: req.user._id,
      isActive: true,
    });
    if (!match) return err(res, 'Conversation not found', 404);

    const msgType = ['text', 'sticker'].includes(type) ? type : 'text';
    const message = await Message.create({
      matchId: match._id,
      senderId: req.user._id,
      content: content.trim(),
      type: msgType,
      readBy: [req.user._id],
    });

    const otherId = match.users
      .find((u) => u.toString() !== req.user._id.toString())
      ?.toString();

    await Match.findByIdAndUpdate(match._id, {
      lastMessage: content.trim().slice(0, 100),
      lastMessageAt: new Date(),
      lastMessageBy: req.user._id,
      ...(otherId ? { $inc: { [`unreadCounts.${otherId}`]: 1 } } : {}),
    });

    const payload = {
      id: message._id.toString(),
      matchId: match._id.toString(),
      senderId: req.user._id.toString(),
      content: message.content,
      type: message.type,
      createdAt: message.createdAt.toISOString(),
      readBy: [req.user._id.toString()],
    };

    // Push via socket if server instance is available
    try {
      const { getIO } = require('../services/socketService');
      const io = getIO();
      if (io) {
        io.to(`user:${req.user._id.toString()}`).emit('chat:receive', payload);
        if (otherId) io.to(`user:${otherId}`).emit('chat:receive', payload);
      }
    } catch (_) {}

    ok(res, payload, 201);
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

// ── DELETE /api/conversations/:matchId — unmatch ──────────────────────────────
// Tombstones the match: sets isActive=false so it disappears from both users'
// chat lists. Messages stay in the DB for moderation review.
router.delete('/:matchId', auth, async (req, res, next) => {
  try {
    const match = await Match.findOne({
      _id: req.params.matchId,
      users: req.user._id,
    });
    if (!match) return err(res, 'Conversation not found', 404);

    match.isActive = false;
    await match.save();

    // Push to BOTH users so their chat lists update in real time.
    try {
      const { getIO } = require('../services/socketService');
      const io = getIO();
      if (io) {
        for (const uid of match.users.map((u) => u.toString())) {
          io.to(`user:${uid}`).emit('match:removed', { matchId: match._id.toString() });
        }
      }
    } catch (_) {}

    ok(res, { success: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
