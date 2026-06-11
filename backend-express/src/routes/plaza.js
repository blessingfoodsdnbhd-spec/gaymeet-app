const router = require('express').Router();
const UserTopicRoom = require('../models/UserTopicRoom');
const TopicRoomReport = require('../models/TopicRoomReport');
const { auth } = require('../middleware/auth');
const { requireAdminAuth } = require('../middleware/adminAuth');
const { ok, created, err } = require('../utils/respond');
const { scanScam } = require('../utils/contentSafety');

const TITLE_MAX = 30;
const DESC_MAX = 100;
const EMOJI_MAX = 8;
const DEFAULT_EMOJI = '💬';

// Creation quotas. Daily = rooms created in the last 24h; lifetime = rooms the
// user currently owns (auto-deleted rooms free the slot back up).
const DAILY_LIMIT = { free: 1, premium: 3 };
const LIFETIME_LIMIT = { free: 5, premium: 30 };
const DAY_MS = 24 * 60 * 60 * 1000;

// Same slur blocklist the World Chat composer uses — applied to title + desc.
const BLOCKLIST = /\b(n[i1]gg(?:er|a)|f[a4]gg?ot|ch?ink|k[i1]ke|sp[i1]c|retard|cunt)\b/i;

/** A user is Premium if their isPremium flag or VIP level is active (unexpired). */
function isPremiumUser(u) {
  const now = Date.now();
  if (u.isPremium && (!u.premiumExpiresAt || new Date(u.premiumExpiresAt).getTime() > now)) return true;
  if ((u.vipLevel || 0) > 0 && (!u.vipExpiresAt || new Date(u.vipExpiresAt).getTime() > now)) return true;
  return false;
}

function roomOnlineCount(roomId) {
  try {
    return require('../services/socketService').roomOnlineCount(roomId);
  } catch (_) {
    return 0;
  }
}

function serializeRoom(room) {
  const c = room.creatorId;
  const creator =
    c && c._id ? { id: c._id.toString(), displayName: c.nickname, avatarUrl: c.avatarUrl ?? null } : { id: String(c) };
  return {
    id: room.roomId,
    title: room.title,
    emoji: room.emoji || DEFAULT_EMOJI,
    description: room.description || '',
    category: room.category,
    creator,
    pinned: !!room.pinned,
    onlineCount: roomOnlineCount(room.roomId),
    lastActivityAt: room.lastActivityAt,
    createdAt: room.createdAt,
  };
}

async function quotaFor(user) {
  const premium = isPremiumUser(user);
  const tier = premium ? 'premium' : 'free';
  const [dailyUsed, lifetimeUsed] = await Promise.all([
    UserTopicRoom.countDocuments({ creatorId: user._id, createdAt: { $gte: new Date(Date.now() - DAY_MS) } }),
    UserTopicRoom.countDocuments({ creatorId: user._id, archived: false }),
  ]);
  return {
    isPremium: premium,
    daily: { used: dailyUsed, limit: DAILY_LIMIT[tier] },
    lifetime: { used: lifetimeUsed, limit: LIFETIME_LIMIT[tier] },
  };
}

// ── GET /api/plaza/rooms/quota ────────────────────────────────────────────────
// Current creation allowance — drives the "今日剩余 N / M" line on the create form.
router.get('/rooms/quota', auth, async (req, res, next) => {
  try {
    ok(res, await quotaFor(req.user));
  } catch (e) {
    next(e);
  }
});

// ── POST /api/plaza/rooms/create ──────────────────────────────────────────────
// Create a UGC topic room. It immediately joins the pool 热门 ranks from (always
// below the official rooms). Voice category is locked until Phase 4.
router.post('/rooms/create', auth, async (req, res, next) => {
  try {
    const title = String(req.body?.title ?? '').trim();
    const description = String(req.body?.description ?? '').trim();
    const emoji = String(req.body?.emoji ?? '').trim() || DEFAULT_EMOJI;
    const category = String(req.body?.category ?? 'topic');

    if (!title) return err(res, 'Title is required');
    if (title.length > TITLE_MAX) return err(res, `Title too long (max ${TITLE_MAX})`);
    if (description.length > DESC_MAX) return err(res, `Description too long (max ${DESC_MAX})`);
    if (emoji.length > EMOJI_MAX) return err(res, 'Emoji too long');
    if (category !== 'topic') return err(res, 'Voice rooms are coming soon', 403);

    // Content safety on the visible text (slurs + scam/off-platform cues).
    const safetyTarget = `${title} ${description}`;
    if (BLOCKLIST.test(safetyTarget) || scanScam(safetyTarget).flagged) {
      return err(res, 'Blocked by content filter', 422);
    }

    const quota = await quotaFor(req.user);
    if (quota.daily.used >= quota.daily.limit) {
      return res.status(429).json({ error: 'Daily room limit reached', code: 'DAILY_QUOTA', quota });
    }
    if (quota.lifetime.used >= quota.lifetime.limit) {
      return res.status(429).json({ error: 'Room limit reached', code: 'LIFETIME_QUOTA', quota });
    }

    // new ...() generates _id synchronously, so we can derive the stable roomId
    // before the first save (the roomId unique index forbids a null placeholder).
    const room = new UserTopicRoom({
      title,
      description,
      emoji,
      category: 'topic',
      creatorId: req.user._id,
      lastActivityAt: new Date(),
    });
    room.roomId = `user-topic:${room._id.toString()}`;
    await room.save();
    room.creatorId = req.user; // for serialize

    created(res, serializeRoom(room));
  } catch (e) {
    next(e);
  }
});

// ── POST /api/plaza/rooms/report ──────────────────────────────────────────────
router.post('/rooms/report', auth, async (req, res, next) => {
  try {
    const roomId = String(req.body?.roomId ?? '');
    const reason = String(req.body?.reason ?? '').slice(0, 300);
    const room = await UserTopicRoom.findOne({ roomId }).select('title creatorId').lean();
    await TopicRoomReport.create({
      reporterId: req.user._id,
      roomId,
      reportedUserId: room ? room.creatorId : null,
      title: room ? room.title : '',
      reason,
    });
    ok(res, { ok: true });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/plaza/admin/rooms/archive ───────────────────────────────────────
// Moderation: hide a room from listings without dropping its record/reports.
router.post('/admin/rooms/archive', requireAdminAuth, async (req, res, next) => {
  try {
    const roomId = String(req.body?.roomId ?? '');
    const room = await UserTopicRoom.findOneAndUpdate({ roomId }, { $set: { archived: true } }, { new: true });
    if (!room) return err(res, 'Room not found', 404);
    try {
      require('../services/socketService').getIO().emit('world-chat:room-deleted', { roomId });
    } catch (_) {
      /* socket layer not ready */
    }
    ok(res, { ok: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
