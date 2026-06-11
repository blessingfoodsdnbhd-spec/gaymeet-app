const router = require('express').Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const UserXP = require('../models/UserXP');
const XPEvent = require('../models/XPEvent');
const InterestChannel = require('../models/InterestChannel');
const { auth } = require('../middleware/auth');
const { ok, err } = require('../utils/respond');
const { levelInfo } = require('../utils/xp');
const { CHANNELS, channelRoomId, isInterestRoomId } = require('../config/interestChannels');
const { VALID_ROOM_IDS } = require('../config/worldChatRooms');
const { isPremiumActive } = require('../utils/premium');

const isCustomRoomId = (id) => typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id);

function roomCount(roomId) {
  try {
    return require('../services/socketService').roomOnlineCount(roomId);
  } catch (_) {
    return 0;
  }
}
function roomUserIds(roomId) {
  try {
    return require('../services/socketService').roomOnlineUserIds(roomId);
  } catch (_) {
    return [];
  }
}

// Lazily mirror the config seed list into the InterestChannel collection so the
// DB copy exists for admin edits. Idempotent: only inserts the ones missing.
async function ensureChannelsSeeded() {
  try {
    const count = await InterestChannel.estimatedDocumentCount();
    if (count >= CHANNELS.length) return;
    const ops = CHANNELS.map((c) => ({
      updateOne: {
        filter: { _id: channelRoomId(c.key) },
        update: {
          $setOnInsert: {
            _id: channelRoomId(c.key),
            key: c.key,
            name: c.en,
            i18nKey: c.i18nKey,
            emoji: c.emoji,
          },
        },
        upsert: true,
      },
    }));
    await InterestChannel.bulkWrite(ops, { ordered: false });
  } catch (_) {
    /* best-effort — endpoint falls back to the config list */
  }
}

// ── GET /api/plaza/channels ───────────────────────────────────────────────────
// Interest channels + live online counts, hottest first. i18nKey/emoji let the
// client localize the label.
router.get('/channels', auth, async (req, res, next) => {
  try {
    await ensureChannelsSeeded();
    const docs = await InterestChannel.find().lean();
    const byId = new Map(docs.map((d) => [d._id, d]));
    const channels = CHANNELS.map((c) => {
      const id = channelRoomId(c.key);
      const d = byId.get(id) || {};
      return {
        id,
        key: c.key,
        emoji: d.emoji || c.emoji,
        i18nKey: c.i18nKey,
        name: d.name || c.en,
        description: d.description || '',
        pinned: !!d.pinned,
        onlineCount: roomCount(id),
      };
    });
    channels.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.onlineCount - a.onlineCount);
    ok(res, { channels });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/plaza/rooms/:id/online ──────────────────────────────────────────
// Online users in a room (world / country / interest / custom). mIRC-style list.
router.get('/rooms/:id/online', auth, async (req, res, next) => {
  try {
    const id = req.params.id;
    const valid = id === 'world' || VALID_ROOM_IDS.has(id) || isInterestRoomId(id) || isCustomRoomId(id);
    if (!valid) return err(res, 'Invalid room', 400);

    const ids = roomUserIds(id)
      .filter((v, i, a) => a.indexOf(v) === i) // a user may have ≥1 socket
      .map((s) => String(s));
    if (!ids.length) return ok(res, { online: 0, users: [] });

    const objIds = ids
      .filter((s) => mongoose.isValidObjectId(s))
      .map((s) => new mongoose.Types.ObjectId(s));

    const [users, xpRows] = await Promise.all([
      User.find({ _id: { $in: objIds } })
        .select('nickname avatarUrl isOfficial isPremium premiumExpiresAt vipLevel vipExpiresAt countryCode city')
        .lean(),
      UserXP.find({ userId: { $in: objIds } }).select('userId level').lean(),
    ]);
    const levelByUser = new Map(xpRows.map((r) => [r.userId.toString(), r.level]));

    const list = users.map((u) => ({
      id: u._id.toString(),
      displayName: u.nickname,
      avatarUrl: u.avatarUrl ?? null,
      isOfficial: u.isOfficial ?? false,
      isPremium: isPremiumActive(u),
      countryCode: u.countryCode ?? null,
      city: u.city ?? null,
      level: levelByUser.get(u._id.toString()) ?? 1,
    }));
    // Admins/official first, then by level desc, then name.
    list.sort(
      (a, b) =>
        (b.isOfficial ? 1 : 0) - (a.isOfficial ? 1 : 0) ||
        b.level - a.level ||
        a.displayName.localeCompare(b.displayName),
    );
    ok(res, { online: list.length, users: list });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/plaza/leaderboard?period=daily|weekly|all ───────────────────────
router.get('/leaderboard', auth, async (req, res, next) => {
  try {
    const period = ['daily', 'weekly', 'all'].includes(req.query.period) ? req.query.period : 'weekly';
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);

    let ranked; // [{ userId, xp, level }]
    if (period === 'all') {
      const rows = await UserXP.find().sort({ totalXP: -1 }).limit(limit).select('userId totalXP level').lean();
      ranked = rows.map((r) => ({ userId: r.userId, xp: r.totalXP, level: r.level }));
    } else {
      const windowMs = period === 'daily' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
      const since = new Date(Date.now() - windowMs);
      const agg = await XPEvent.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$userId', xp: { $sum: '$amount' } } },
        { $sort: { xp: -1 } },
        { $limit: limit },
      ]);
      const lvRows = await UserXP.find({ userId: { $in: agg.map((a) => a._id) } }).select('userId level').lean();
      const lvBy = new Map(lvRows.map((r) => [r.userId.toString(), r.level]));
      ranked = agg.map((a) => ({ userId: a._id, xp: a.xp, level: lvBy.get(a._id.toString()) ?? 1 }));
    }

    const users = await User.find({ _id: { $in: ranked.map((r) => r.userId) } })
      .select('nickname avatarUrl isOfficial isPremium premiumExpiresAt vipLevel vipExpiresAt')
      .lean();
    const uBy = new Map(users.map((u) => [u._id.toString(), u]));

    const leaderboard = ranked
      .map((r, i) => {
        const u = uBy.get(r.userId.toString());
        if (!u) return null;
        return {
          rank: i + 1,
          userId: r.userId.toString(),
          displayName: u.nickname,
          avatarUrl: u.avatarUrl ?? null,
          isOfficial: u.isOfficial ?? false,
          isPremium: isPremiumActive(u),
          xp: r.xp,
          level: r.level,
        };
      })
      .filter(Boolean);

    ok(res, { period, leaderboard });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/plaza/users/:id/level ───────────────────────────────────────────
// Mirrors /api/users/:id/level (registered in routes/users.js). 'me' → self.
router.get('/users/:id/level', auth, async (req, res, next) => {
  try {
    const id = req.params.id === 'me' ? req.user._id.toString() : req.params.id;
    if (!mongoose.isValidObjectId(id)) return err(res, 'Invalid id', 400);
    const xp = await UserXP.findOne({ userId: id }).select('totalXP').lean();
    ok(res, levelInfo(xp?.totalXP ?? 0));
  } catch (e) {
    next(e);
  }
});

module.exports = router;
