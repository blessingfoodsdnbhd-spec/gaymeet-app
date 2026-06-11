const router = require('express').Router();
const mongoose = require('mongoose');
const { auth } = require('../middleware/auth');
const { ok } = require('../utils/respond');
const User = require('../models/User');
const VoteEvent = require('../models/VoteEvent');
const ChatRoom = require('../models/ChatRoom');
const WorldChatMessage = require('../models/WorldChatMessage');
const WorldChatBan = require('../models/WorldChatBan');
const { blockedIdSet, blockedIdArray } = require('../utils/blocking');
const { ROOMS, VALID_ROOM_IDS } = require('../config/worldChatRooms');

// Escape user input before building a RegExp so "." / "*" etc. are literal and
// a crafted query can't ReDoS or match unexpectedly.
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// A custom (user-created) room id is a 24-hex ChatRoom _id (mirrors the helper
// in routes/worldChat.js).
const isCustomRoomId = (id) => typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id);

const BUILTIN_BY_ID = new Map(ROOMS.map((r) => [r.id, r]));

/** Built-in (world/country) room → a self-contained, client-localizable meta. */
function builtinMeta(r) {
  return { roomId: r.id, custom: false, roomFlag: r.flag, roomLabel: { en: r.en, zh: r.zh, native: r.native } };
}
/** Custom room → meta. A custom room carries no flag; its title is used for all locales. */
function customMeta(id, title) {
  const t = title || 'Room';
  return { roomId: id, custom: true, roomFlag: null, roomLabel: { en: t, zh: t, native: t } };
}

// The set of message room-ids a user may search across: every built-in room
// (world + countries, incl. legacy null/absent docs) plus the custom rooms they
// have actually joined. This mirrors GET /world-chat/recent, which 403s a
// non-member out of ANY custom room regardless of privacy — so a tapped result
// always opens a room the user can read.
async function visibleMessageRoomClause(user) {
  const memberRoomIds = (await ChatRoom.find({ memberIds: user._id }).distinct('_id')).map(String);
  const or = [
    { roomId: { $in: [...VALID_ROOM_IDS] } }, // world + country codes
    { roomId: { $exists: false } }, // legacy docs predating the field
    { roomId: null },
  ];
  if (memberRoomIds.length) or.push({ roomId: { $in: memberRoomIds } });
  return { $or: or };
}

// Resolve a single-room scope (?room=<id>) to a Mongo roomId clause, enforcing
// access. Returns null when the user may not read that room.
async function singleRoomClause(roomId, user) {
  if (isCustomRoomId(roomId)) {
    const room = await ChatRoom.findById(roomId).select('memberIds');
    if (!room || !room.memberIds.some((m) => String(m) === String(user._id))) return null;
    return { roomId };
  }
  if (roomId === 'world') {
    return { $or: [{ roomId: 'world' }, { roomId: { $exists: false } }, { roomId: null }] };
  }
  if (VALID_ROOM_IDS.has(roomId)) return { roomId };
  return null; // unknown room
}

function roomCounts() {
  try {
    return require('../services/socketService').getRoomCounts();
  } catch (_) {
    return {};
  }
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
    // Symmetric (mutual) block — hide anyone the viewer blocked OR who blocked them.
    const blocked = await blockedIdArray(req.user);

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

// ── GET /api/search/messages?q=&room=&limit= ──────────────────────────────────
// Full-text-ish search of Plaza messages the user can read. `room` defaults to
// '*' (every visible room); pass a single roomId to scope. Regex substring (not
// a Mongo $text index) on purpose — the messages collection is bounded by a
// 7-day TTL and substring + CJK matching beats $text word-stemming for a
// multilingual chat. Blocked + admin-banned senders are excluded. (CCCCCCC)
router.get('/messages', auth, async (req, res, next) => {
  try {
    const q = (req.query.q || '').toString().trim();
    if (q.length < 1) return ok(res, { messages: [] });
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 50);
    const rx = new RegExp(escapeRegex(q), 'i');
    const roomParam = (req.query.room || '*').toString();

    let roomClause;
    if (roomParam && roomParam !== '*') {
      roomClause = await singleRoomClause(roomParam, req.user);
      if (!roomClause) return ok(res, { messages: [] }); // no access / unknown room
    } else {
      roomClause = await visibleMessageRoomClause(req.user);
    }

    const blockedSet = await blockedIdSet(req.user);
    const bannedIds = await WorldChatBan.find().distinct('userId');
    const excludeIds = [...new Set([...blockedSet, ...bannedIds.map(String)])].map(
      (id) => new mongoose.Types.ObjectId(id),
    );

    const rows = await WorldChatMessage.find({
      $and: [
        { $or: [{ body: rx }, { caption: rx }] },
        { userId: { $nin: excludeIds } },
        roomClause,
      ],
    })
      .sort({ _id: -1 })
      .limit(limit)
      .populate('userId', 'nickname avatarUrl isOfficial')
      .lean();

    // Resolve titles for any custom rooms that appear in the results (one query).
    const customIds = [...new Set(rows.map((m) => m.roomId).filter((id) => isCustomRoomId(id)))];
    const customRooms = customIds.length
      ? await ChatRoom.find({ _id: { $in: customIds } }).select('title').lean()
      : [];
    const customTitleById = new Map(customRooms.map((c) => [String(c._id), c.title]));
    const metaFor = (roomId) => {
      const id = roomId || 'world';
      if (BUILTIN_BY_ID.has(id)) return builtinMeta(BUILTIN_BY_ID.get(id));
      if (isCustomRoomId(id)) return customMeta(id, customTitleById.get(id));
      return builtinMeta(BUILTIN_BY_ID.get('world'));
    };

    const messages = rows
      .filter((m) => m.userId) // populate → null if the sender was deleted
      .map((m) => {
        const meta = metaFor(m.roomId);
        return {
          messageId: m._id.toString(),
          ...meta,
          userId: m.userId._id.toString(),
          displayName: m.userId.nickname,
          avatarUrl: m.userId.avatarUrl ?? null,
          isOfficial: m.userId.isOfficial ?? false,
          type: m.type || 'text',
          body: m.body || '',
          caption: m.caption ?? null,
          createdAt: m.createdAt.toISOString(),
        };
      });

    ok(res, { messages });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/search/rooms?q= ──────────────────────────────────────────────────
// Find rooms by name: built-in world/country rooms (matched on any locale
// label) AND user-created rooms (title/description) the viewer can see. Returns
// live online counts. Built-in rooms come first. (CCCCCCC)
router.get('/rooms', auth, async (req, res, next) => {
  try {
    const q = (req.query.q || '').toString().trim();
    if (q.length < 1) return ok(res, { rooms: [] });
    const ql = q.toLowerCase();
    const rx = new RegExp(escapeRegex(q), 'i');
    const counts = roomCounts();

    const builtin = ROOMS.filter((r) =>
      [r.en, r.zh, r.native].some((n) => n.toLowerCase().includes(ql)),
    ).map((r) => ({
      id: r.id,
      kind: 'builtin',
      flag: r.flag,
      label: { en: r.en, zh: r.zh, native: r.native },
      onlineCount: counts[r.id] ?? 0,
    }));

    // Visible custom rooms: public, or ones the viewer owns / has joined.
    const customDocs = await ChatRoom.find({
      $and: [
        { $or: [{ title: rx }, { description: rx }] },
        { $or: [{ isPrivate: false }, { memberIds: req.user._id }, { creatorId: req.user._id }] },
      ],
    })
      .sort({ lastActiveAt: -1 })
      .limit(20)
      .lean();

    const meId = String(req.user._id);
    const custom = customDocs.map((r) => {
      const id = String(r._id);
      return {
        id,
        kind: 'custom',
        flag: null,
        label: { en: r.title, zh: r.title, native: r.title },
        description: r.description || '',
        countryCode: r.countryCode,
        memberCount: (r.memberIds || []).length,
        isMember: (r.memberIds || []).some((m) => String(m) === meId),
        onlineCount: counts[id] ?? 0,
      };
    });

    ok(res, { rooms: [...builtin, ...custom] });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/search/users?q=&room= ────────────────────────────────────────────
// Search users by nickname. Pass `room` to restrict to people who have posted
// in that room (find-people-in-this-room). Excludes mutually-blocked users.
router.get('/users', auth, async (req, res, next) => {
  try {
    const q = (req.query.q || '').toString().trim();
    if (q.length < 1) return ok(res, { users: [] });
    const rx = new RegExp(escapeRegex(q), 'i');
    const meId = req.user._id;
    const blocked = await blockedIdArray(req.user);

    const filter = {
      nickname: rx,
      _id: { $ne: meId, $nin: blocked },
      isDeleted: { $ne: true },
    };

    const roomParam = (req.query.room || '').toString();
    if (roomParam && roomParam !== '*') {
      const clause = await singleRoomClause(roomParam, req.user);
      if (!clause) return ok(res, { users: [] });
      const posterIds = await WorldChatMessage.find(clause).distinct('userId');
      if (!posterIds.length) return ok(res, { users: [] });
      filter._id = { $in: posterIds, $ne: meId, $nin: blocked };
    }

    const users = await User.find(filter)
      .select('nickname avatarUrl photos isOfficial isVerified')
      .limit(20)
      .lean();

    ok(res, {
      users: users.map((u) => ({
        id: String(u._id),
        nickname: u.nickname,
        avatarUrl: u.avatarUrl || (u.photos && u.photos[0]) || null,
        isOfficial: !!u.isOfficial,
        isVerified: !!u.isVerified,
      })),
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
