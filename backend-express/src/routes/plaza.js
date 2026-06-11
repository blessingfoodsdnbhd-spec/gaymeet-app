// Plaza Phase 3 — random matchmaking + daily leaderboards.
//
// Matchmaking sessions/messages are realtime + ephemeral (see
// services/matchmakingService.js and the WS handlers in socketService.js).
// These HTTP endpoints drive queue entry/exit; the live match + chat flow runs
// over WS. "Add friend" reuses the existing POST /api/users/:id/follow.

const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { ok, err } = require('../utils/respond');
const { isPremiumActive } = require('../utils/premium');
const matchmaking = require('../services/matchmakingService');
const PlazaDailyXp = require('../models/PlazaDailyXp');
const ChatRoom = require('../models/ChatRoom');
const { computeRole } = require('../utils/role');
const { ROOMS } = require('../config/worldChatRooms');

// ── POST /api/plaza/match/join ────────────────────────────────────────────────
// Body: { filters?: { ageMin, ageMax, countryCode, language } } — filters are
// Premium-only; ignored for free users (they match anyone).
router.post('/match/join', auth, async (req, res, next) => {
  try {
    const filters = isPremiumActive(req.user) ? req.body?.filters || {} : {};
    const result = await matchmaking.join(req.user, filters);
    ok(res, result);
  } catch (e) {
    next(e);
  }
});

// ── POST /api/plaza/match/next — drop current match, find another ─────────────
router.post('/match/next', auth, async (req, res, next) => {
  try {
    const result = await matchmaking.next(req.user);
    ok(res, result);
  } catch (e) {
    next(e);
  }
});

// ── POST /api/plaza/match/leave — exit queue + any session ────────────────────
router.post('/match/leave', auth, async (req, res, next) => {
  try {
    await matchmaking.leave(req.user._id.toString());
    ok(res, { ok: true });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/plaza/leaderboard/rooms?period=today — hottest rooms ─────────────
// Merges the built-in country/world rooms with the busiest user-created rooms,
// ranked by live online count.
router.get('/leaderboard/rooms', auth, async (req, res, next) => {
  try {
    const { getRoomCounts, roomOnlineCount } = require('../services/socketService');
    const counts = getRoomCounts();

    const builtin = ROOMS.map((r) => ({
      id: r.id,
      kind: 'builtin',
      flag: r.flag,
      label: { en: r.en, zh: r.zh, native: r.native },
      onlineCount: counts[r.id] ?? 0,
    }));

    // Busiest user-created rooms by recent activity, then scored by live online.
    const customRooms = await ChatRoom.find({ status: 'open' })
      .sort({ lastActiveAt: -1 })
      .limit(30)
      .select('title countryCode messageCount')
      .lean();
    const custom = customRooms.map((r) => ({
      id: r._id.toString(),
      kind: 'custom',
      flag: '💬',
      label: { en: r.title, zh: r.title, native: r.title },
      onlineCount: roomOnlineCount(r._id.toString()),
    }));

    const rooms = [...builtin, ...custom]
      .sort((a, b) => b.onlineCount - a.onlineCount)
      .slice(0, 15);

    ok(res, { rooms });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/plaza/leaderboard/users?period=today — most active users ─────────
router.get('/leaderboard/users', auth, async (req, res, next) => {
  try {
    const period = req.query.period === 'yesterday' ? 'yesterday' : 'today';
    const day =
      period === 'yesterday'
        ? PlazaDailyXp.dayKey(new Date(Date.now() - 24 * 60 * 60 * 1000))
        : PlazaDailyXp.dayKey();

    const rows = await PlazaDailyXp.find({ day, xp: { $gt: 0 } })
      .sort({ xp: -1 })
      .limit(20)
      .populate('userId', 'nickname avatarUrl isOfficial isPremium premiumExpiresAt vipLevel vipExpiresAt level createdAt')
      .lean();

    const users = rows
      .filter((r) => r.userId)
      .map((r, i) => ({
        rank: i + 1,
        userId: r.userId._id.toString(),
        nickname: r.userId.nickname,
        avatarUrl: r.userId.avatarUrl ?? null,
        role: computeRole(r.userId),
        xp: r.xp,
      }));

    ok(res, { period, day, users });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
