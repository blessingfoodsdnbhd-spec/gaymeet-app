const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { ok } = require('../utils/respond');
const User = require('../models/User');
const VoteEvent = require('../models/VoteEvent');
const ChatRoom = require('../models/ChatRoom');

// Escape user input before building a RegExp so "." / "*" etc. are literal and
// a crafted query can't ReDoS or match unexpectedly.
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── GET /api/search?q=&type= ──────────────────────────────────────────────────
// Unified search over users (nickname), vote events (title) and chat rooms
// (title). type ∈ all | users | votes | rooms (default all). Case-insensitive
// substring match; results capped at 20 per kind. (SEARCH1)
router.get('/', auth, async (req, res, next) => {
  try {
    const q = (req.query.q || '').toString().trim();
    const type = (req.query.type || 'all').toString();
    if (q.length < 1) return ok(res, { users: [], votes: [], rooms: [] });

    const rx = new RegExp(escapeRegex(q), 'i');
    const meId = req.user._id;
    const blocked = (req.user.blockedUsers || []).map(String);

    const wantUsers = type === 'all' || type === 'users';
    const wantVotes = type === 'all' || type === 'votes';
    const wantRooms = type === 'all' || type === 'rooms';

    const [users, votes, rooms] = await Promise.all([
      wantUsers
        ? User.find({
            nickname: rx,
            _id: { $ne: meId, $nin: blocked },
            isDeleted: { $ne: true },
          })
            .select('nickname avatarUrl photos isOfficial isVerified')
            .limit(20)
            .lean()
        : [],
      wantVotes
        ? VoteEvent.find({ title: rx })
            .select('title status category')
            .sort({ startAt: -1 })
            .limit(20)
            .lean()
        : [],
      wantRooms
        ? ChatRoom.find({ title: rx, isActive: { $ne: false } })
            .select('title country memberCount onlineCount')
            .limit(20)
            .lean()
        : [],
    ]);

    ok(res, {
      users: users.map((u) => ({
        id: String(u._id),
        nickname: u.nickname,
        avatarUrl: u.avatarUrl || (u.photos && u.photos[0]) || null,
        isOfficial: !!u.isOfficial,
        isVerified: !!u.isVerified,
      })),
      votes: votes.map((v) => ({
        id: String(v._id),
        title: v.title,
        status: v.status,
        category: v.category,
      })),
      rooms: rooms.map((r) => ({
        id: String(r._id),
        title: r.title,
        memberCount: r.memberCount ?? 0,
      })),
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
