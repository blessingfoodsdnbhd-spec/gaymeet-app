const router = require('express').Router();
const crypto = require('crypto');
const mongoose = require('mongoose');
const WorldChatMessage = require('../models/WorldChatMessage');
const WorldChatBan = require('../models/WorldChatBan');
const WorldChatReport = require('../models/WorldChatReport');
const ChatRoom = require('../models/ChatRoom');
const Follow = require('../models/Follow');
const { notify } = require('../services/notificationService');
const { auth } = require('../middleware/auth');
const { requireAdminAuth } = require('../middleware/adminAuth');
const { ok, created, err } = require('../utils/respond');
const { ROOMS, VALID_ROOM_IDS, socketRoom } = require('../config/worldChatRooms');

const BODY_MAX = 500;
const RATE_MS = 3000; // 1 message / 3s / user
const TITLE_MAX = 80;
const DESC_MAX = 300;
const MAX_ROOMS_PER_USER = 20; // soft anti-spam cap on open rooms one user owns

// A custom (user-created) room id is a 24-hex ChatRoom _id; a country room is
// one of VALID_ROOM_IDS. Anything else is treated as the global 'world' room.
const isCustomRoomId = (id) => typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id);

// ── Private-room password hashing (scrypt, dependency-free) ───────────────────
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${crypto.scryptSync(String(pw), salt, 32).toString('hex')}`;
}
function verifyPassword(pw, stored) {
  if (!stored || typeof stored !== 'string') return false;
  const [salt, h] = stored.split(':');
  if (!salt || !h) return false;
  const cand = crypto.scryptSync(String(pw), salt, 32).toString('hex');
  const a = Buffer.from(h, 'hex');
  const b = Buffer.from(cand, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const sameId = (a, b) => String(a?._id ?? a) === String(b?._id ?? b);

/** Public room shape. Never leaks passwordHash. */
function serializeRoom(room, userId, onlineCount) {
  const c = room.creatorId;
  const creator =
    c && c._id ? { id: c._id.toString(), displayName: c.nickname, avatarUrl: c.avatarUrl ?? null } : { id: String(c) };
  return {
    id: room._id.toString(),
    countryCode: room.countryCode,
    title: room.title,
    description: room.description || '',
    isPrivate: room.isPrivate,
    status: room.status,
    creator,
    isCreator: sameId(c, userId),
    isMember: (room.memberIds || []).some((m) => sameId(m, userId)),
    memberCount: (room.memberIds || []).length,
    onlineCount: onlineCount ?? 0,
    lastActiveAt: room.lastActiveAt,
    createdAt: room.createdAt,
  };
}

function roomCount(roomId) {
  try {
    return require('../services/socketService').roomOnlineCount(roomId);
  } catch (_) {
    return 0;
  }
}

// In-memory per-user rate-limit timestamps. Single-process is fine for our
// scale; periodic cleanup keeps the map small.
const lastSent = new Map(); // userId -> epoch ms
setInterval(() => {
  const cutoff = Date.now() - 60_000;
  for (const [k, ts] of lastSent) if (ts < cutoff) lastSent.delete(k);
}, 60_000).unref?.();

// Minimal slur/spam blocklist — Apple cares about REPORTING infra, not perfect
// filtering, so this is deliberately small. Case-insensitive, word-boundary.
const BLOCKLIST = /\b(n[i1]gg(?:er|a)|f[a4]gg?ot|ch?ink|k[i1]ke|sp[i1]c|retard|cunt)\b/i;

// Broadcast scoped to one chat room (or global when roomId omitted).
function broadcast(event, payload, roomId) {
  try {
    const io = require('../services/socketService').getIO();
    if (roomId) io.to(socketRoom(roomId)).emit(event, payload);
    else io.emit(event, payload);
  } catch (_) {
    // Socket layer not ready / no clients — non-fatal.
  }
}

// ── POST /api/world-chat/send ─────────────────────────────────────────────────
router.post('/send', auth, async (req, res, next) => {
  try {
    const body = String(req.body?.body ?? '').trim();
    if (!body) return err(res, 'Message is empty');
    if (body.length > BODY_MAX) return err(res, `Message too long (max ${BODY_MAX})`);

    const rid = req.body?.roomId;
    const custom = isCustomRoomId(rid);
    const roomId = VALID_ROOM_IDS.has(rid) || custom ? rid : 'world';

    const banned = await WorldChatBan.exists({ userId: req.user._id });
    if (banned) return err(res, 'You are banned from World Chat', 403);

    // Custom rooms: must exist, be open, and the sender must be a member.
    if (custom) {
      const room = await ChatRoom.findById(roomId).select('status memberIds');
      if (!room) return err(res, 'Room not found', 404);
      if (room.status === 'closed') return err(res, 'This room is closed', 403);
      if (!room.memberIds.some((m) => sameId(m, req.user._id))) return err(res, 'Join the room first', 403);
    }

    if (BLOCKLIST.test(body)) return err(res, 'Message blocked by content filter', 422);

    const uid = req.user._id.toString();
    const now = Date.now();
    const prev = lastSent.get(uid) || 0;
    if (now - prev < RATE_MS) {
      return res.status(429).json({ error: 'Slow down', code: 'RATE_LIMIT' });
    }
    lastSent.set(uid, now);

    const msg = await WorldChatMessage.create({ userId: req.user._id, roomId, body });

    // Keep the room list sortable + show activity.
    if (custom) {
      ChatRoom.updateOne({ _id: roomId }, { $inc: { messageCount: 1 }, $set: { lastActiveAt: new Date() } }).catch(() => {});
    }

    const payload = {
      messageId: msg._id.toString(),
      roomId,
      userId: uid,
      displayName: req.user.nickname,
      avatarUrl: req.user.avatarUrl ?? null,
      isOfficial: req.user.isOfficial ?? false,
      countryCode: req.user.countryCode ?? null,
      city: req.user.city ?? null,
      body: msg.body,
      createdAt: msg.createdAt.toISOString(),
    };
    broadcast('world-chat:receive', payload, roomId);
    created(res, payload);
  } catch (e) {
    next(e);
  }
});

// ── GET /api/world-chat/rooms ─────────────────────────────────────────────────
// Available rooms + live online counts (from the socket adapter).
router.get('/rooms', auth, async (req, res, next) => {
  try {
    let counts = {};
    try {
      counts = require('../services/socketService').getRoomCounts();
    } catch (_) {
      // socket layer not ready
    }
    ok(res, {
      rooms: ROOMS.map((r) => ({
        id: r.id,
        flag: r.flag,
        label: { en: r.en, zh: r.zh, native: r.native },
        onlineCount: counts[r.id] ?? 0,
      })),
    });
  } catch (e) {
    next(e);
  }
});

// ════════════════════════════════════════════════════════════════════════════
// 聊天室 / Custom chat rooms — forum-style rooms inside a country.
// (Declared after `GET /rooms` so the literal country-list path keeps priority.)
// ════════════════════════════════════════════════════════════════════════════

function broadcastToUser(userId, event, payload) {
  try {
    require('../services/socketService').getIO().to(`user:${userId}`).emit(event, payload);
  } catch (_) {
    // socket layer not ready — non-fatal
  }
}

// Create a room in a country. Creator auto-joins.
router.post('/rooms', auth, async (req, res, next) => {
  try {
    const { countryCode, title, description, isPrivate, password } = req.body || {};
    if (!VALID_ROOM_IDS.has(countryCode)) return err(res, 'Invalid country');
    const ttl = String(title ?? '').trim();
    if (!ttl) return err(res, 'Title is required');
    if (ttl.length > TITLE_MAX) return err(res, `Title too long (max ${TITLE_MAX})`);
    const desc = String(description ?? '').trim().slice(0, DESC_MAX);
    const priv = !!isPrivate;
    if (priv && !String(password ?? '').trim()) return err(res, 'Private rooms need a password');

    const owned = await ChatRoom.countDocuments({ creatorId: req.user._id, status: 'open' });
    if (owned >= MAX_ROOMS_PER_USER) return err(res, `You can own at most ${MAX_ROOMS_PER_USER} open rooms`, 429);

    const room = await ChatRoom.create({
      creatorId: req.user._id,
      countryCode,
      title: ttl,
      description: desc,
      isPrivate: priv,
      passwordHash: priv ? hashPassword(String(password).trim()) : null,
      memberIds: [req.user._id],
      lastActiveAt: new Date(),
    });
    room.creatorId = req.user; // populate for serialize
    created(res, serializeRoom(room, req.user._id, roomCount(room._id.toString())));
  } catch (e) {
    next(e);
  }
});

// List rooms in a country. Public-open rooms to everyone; private/closed only
// to members or the creator.
router.get('/rooms/by-country/:countryCode', auth, async (req, res, next) => {
  try {
    const cc = req.params.countryCode;
    if (!VALID_ROOM_IDS.has(cc)) return err(res, 'Invalid country');
    const rooms = await ChatRoom.find({
      countryCode: cc,
      $and: [
        { $or: [{ isPrivate: false }, { memberIds: req.user._id }, { creatorId: req.user._id }] },
        { $or: [{ status: 'open' }, { memberIds: req.user._id }, { creatorId: req.user._id }] },
      ],
    })
      .populate('creatorId', 'nickname avatarUrl')
      .sort({ lastActiveAt: -1 })
      .limit(100)
      .lean();
    ok(res, { rooms: rooms.map((r) => serializeRoom(r, req.user._id, roomCount(r._id.toString()))) });
  } catch (e) {
    next(e);
  }
});

// Friends invitable to a room (creator's follows ∪ followers, minus members).
router.get('/rooms/:id/invitable', auth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return err(res, 'Invalid id');
    const room = await ChatRoom.findById(req.params.id).select('creatorId memberIds');
    if (!room) return err(res, 'Room not found', 404);
    if (!sameId(room.creatorId, req.user._id)) return err(res, 'Only the creator can invite', 403);
    const links = await Follow.find({ $or: [{ follower: req.user._id }, { following: req.user._id }] })
      .select('follower following')
      .lean();
    const memberSet = new Set((room.memberIds || []).map((m) => m.toString()));
    const friendIds = new Set();
    for (const l of links) {
      const other = sameId(l.follower, req.user._id) ? l.following.toString() : l.follower.toString();
      if (!memberSet.has(other)) friendIds.add(other);
    }
    const users = await require('../models/User')
      .find({ _id: { $in: [...friendIds] } })
      .select('nickname avatarUrl')
      .lean();
    ok(res, {
      friends: users.map((u) => ({ id: u._id.toString(), displayName: u.nickname, avatarUrl: u.avatarUrl ?? null })),
    });
  } catch (e) {
    next(e);
  }
});

// Member list (visible to any member or the creator). Powers the kick UI.
router.get('/rooms/:id/members', auth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return err(res, 'Invalid id');
    const room = await ChatRoom.findById(req.params.id).populate('memberIds', 'nickname avatarUrl');
    if (!room) return err(res, 'Room not found', 404);
    const isMember = room.memberIds.some((m) => sameId(m, req.user._id));
    if (!isMember && !sameId(room.creatorId, req.user._id)) return err(res, 'Join the room first', 403);
    ok(res, {
      members: room.memberIds.map((m) => ({
        id: m._id.toString(),
        displayName: m.nickname,
        avatarUrl: m.avatarUrl ?? null,
        isCreator: sameId(room.creatorId, m._id),
      })),
    });
  } catch (e) {
    next(e);
  }
});

// Room detail.
router.get('/rooms/:id', auth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return err(res, 'Invalid id');
    const room = await ChatRoom.findById(req.params.id).populate('creatorId', 'nickname avatarUrl');
    if (!room) return err(res, 'Room not found', 404);
    // Hide a private room from non-members.
    if (room.isPrivate && !sameId(room.creatorId, req.user._id) && !room.memberIds.some((m) => sameId(m, req.user._id))) {
      return err(res, 'Room not found', 404);
    }
    ok(res, { room: serializeRoom(room, req.user._id, roomCount(room._id.toString())) });
  } catch (e) {
    next(e);
  }
});

// Join a room (password required if private).
router.post('/rooms/:id/join', auth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return err(res, 'Invalid id');
    const room = await ChatRoom.findById(req.params.id).populate('creatorId', 'nickname avatarUrl');
    if (!room) return err(res, 'Room not found', 404);
    if (room.status === 'closed') return err(res, 'This room is closed', 403);
    if (!room.memberIds.some((m) => sameId(m, req.user._id))) {
      if (room.isPrivate && !verifyPassword(req.body?.password, room.passwordHash)) {
        return err(res, 'Wrong password', 403);
      }
      room.memberIds.push(req.user._id);
      await room.save();
    }
    ok(res, { room: serializeRoom(room, req.user._id, roomCount(room._id.toString())) });
  } catch (e) {
    next(e);
  }
});

// Leave a room (creator must close/delete instead).
router.post('/rooms/:id/leave', auth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return err(res, 'Invalid id');
    const room = await ChatRoom.findById(req.params.id).select('creatorId');
    if (!room) return err(res, 'Room not found', 404);
    if (sameId(room.creatorId, req.user._id)) return err(res, 'The creator cannot leave — close or delete the room', 400);
    await ChatRoom.updateOne({ _id: room._id }, { $pull: { memberIds: req.user._id } });
    ok(res, { ok: true });
  } catch (e) {
    next(e);
  }
});

// Creator invites friends (people they follow or who follow them).
router.post('/rooms/:id/invite', auth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return err(res, 'Invalid id');
    const room = await ChatRoom.findById(req.params.id).select('creatorId title');
    if (!room) return err(res, 'Room not found', 404);
    if (!sameId(room.creatorId, req.user._id)) return err(res, 'Only the creator can invite', 403);
    const ids = Array.isArray(req.body?.userIds) ? req.body.userIds.filter((x) => mongoose.isValidObjectId(x)) : [];
    if (!ids.length) return err(res, 'No users to invite');
    const links = await Follow.find({
      $or: [
        { follower: req.user._id, following: { $in: ids } },
        { following: req.user._id, follower: { $in: ids } },
      ],
    }).lean();
    const friendIds = new Set();
    for (const l of links) friendIds.add(sameId(l.follower, req.user._id) ? l.following.toString() : l.follower.toString());
    const toAdd = ids.filter((id) => friendIds.has(String(id)));
    if (!toAdd.length) return err(res, 'None of those users are your friends', 400);
    await ChatRoom.updateOne({ _id: room._id }, { $addToSet: { memberIds: { $each: toAdd } } });
    for (const uid of toAdd) {
      broadcastToUser(uid, 'world-chat:room-invited', { roomId: room._id.toString(), title: room.title });
      notify(uid, 'room_invite', {
        title: '你被邀请加入聊天室 💬',
        body: room.title,
        data: { roomId: room._id.toString(), custom: '1' },
      }).catch(() => {});
    }
    const fresh = await ChatRoom.findById(room._id).select('memberIds');
    ok(res, { invited: toAdd.length, memberCount: fresh.memberIds.length });
  } catch (e) {
    next(e);
  }
});

// Creator kicks a member (live-removed via a targeted WS event).
router.delete('/rooms/:id/kick/:userId', auth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(req.params.userId)) {
      return err(res, 'Invalid id');
    }
    const room = await ChatRoom.findById(req.params.id).select('creatorId');
    if (!room) return err(res, 'Room not found', 404);
    if (!sameId(room.creatorId, req.user._id)) return err(res, 'Only the creator can kick', 403);
    if (sameId(req.params.userId, req.user._id)) return err(res, "You can't kick yourself", 400);
    await ChatRoom.updateOne({ _id: room._id }, { $pull: { memberIds: req.params.userId } });
    broadcastToUser(req.params.userId, 'world-chat:kicked', { roomId: room._id.toString() });
    ok(res, { ok: true });
  } catch (e) {
    next(e);
  }
});

// Creator closes a room (history preserved; no new posts).
router.post('/rooms/:id/close', auth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return err(res, 'Invalid id');
    const room = await ChatRoom.findById(req.params.id);
    if (!room) return err(res, 'Room not found', 404);
    if (!sameId(room.creatorId, req.user._id)) return err(res, 'Only the creator can close', 403);
    room.status = 'closed';
    await room.save();
    broadcast('world-chat:room-closed', { roomId: room._id.toString() }, room._id.toString());
    ok(res, { ok: true });
  } catch (e) {
    next(e);
  }
});

// Creator edits title / description / privacy.
router.patch('/rooms/:id', auth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return err(res, 'Invalid id');
    const room = await ChatRoom.findById(req.params.id);
    if (!room) return err(res, 'Room not found', 404);
    if (!sameId(room.creatorId, req.user._id)) return err(res, 'Only the creator can edit', 403);
    const b = req.body || {};
    if (b.title !== undefined) {
      const ttl = String(b.title).trim();
      if (!ttl || ttl.length > TITLE_MAX) return err(res, 'Invalid title');
      room.title = ttl;
    }
    if (b.description !== undefined) room.description = String(b.description).trim().slice(0, DESC_MAX);
    if (b.isPrivate !== undefined) {
      room.isPrivate = !!b.isPrivate;
      if (room.isPrivate) {
        if (b.password !== undefined && String(b.password).trim()) room.passwordHash = hashPassword(String(b.password).trim());
        if (!room.passwordHash) return err(res, 'Private rooms need a password');
      } else {
        room.passwordHash = null;
      }
    } else if (b.password !== undefined && room.isPrivate && String(b.password).trim()) {
      room.passwordHash = hashPassword(String(b.password).trim());
    }
    await room.save();
    room.creatorId = req.user;
    ok(res, { room: serializeRoom(room, req.user._id, roomCount(room._id.toString())) });
  } catch (e) {
    next(e);
  }
});

// Creator hard-deletes a room (and its messages). Confirm required if non-empty.
router.delete('/rooms/:id', auth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return err(res, 'Invalid id');
    const room = await ChatRoom.findById(req.params.id);
    if (!room) return err(res, 'Room not found', 404);
    if (!sameId(room.creatorId, req.user._id)) return err(res, 'Only the creator can delete', 403);
    const confirm = req.body?.confirm === true || req.query.confirm === 'true';
    if (room.messageCount > 0 && !confirm) return err(res, 'Room has messages — confirm required', 409);
    await Promise.all([
      ChatRoom.deleteOne({ _id: room._id }),
      WorldChatMessage.deleteMany({ roomId: room._id.toString() }),
    ]);
    broadcast('world-chat:room-deleted', { roomId: room._id.toString() }, room._id.toString());
    ok(res, { ok: true });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/world-chat/recent?roomId=&before=<msgId>&limit=50 ────────────────
router.get('/recent', auth, async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
    const before = req.query.before;
    const rid = req.query.roomId;
    const custom = isCustomRoomId(rid);
    const roomId = VALID_ROOM_IDS.has(rid) || custom ? rid : 'world';

    // Custom rooms are member-only (public ones are joined frictionlessly first).
    if (custom) {
      const room = await ChatRoom.findById(roomId).select('memberIds');
      if (!room) return err(res, 'Room not found', 404);
      if (!room.memberIds.some((m) => sameId(m, req.user._id))) return err(res, 'Join the room first', 403);
    }

    const bannedIds = await WorldChatBan.find().distinct('userId');
    const blocked = (req.user.blockedUsers || []).map((id) => id.toString());
    const excludeSet = new Set([...bannedIds.map((id) => id.toString()), ...blocked]);
    const excludeIds = [...excludeSet].map((id) => new mongoose.Types.ObjectId(id));

    // roomId:'world' must also match legacy docs that predate the field (null).
    const q = {
      userId: { $nin: excludeIds },
      ...(roomId === 'world' ? { $or: [{ roomId: 'world' }, { roomId: { $exists: false } }, { roomId: null }] } : { roomId }),
    };
    if (before && mongoose.isValidObjectId(before)) {
      q._id = { $lt: new mongoose.Types.ObjectId(before) };
    }

    const rows = await WorldChatMessage.find(q)
      .sort({ _id: -1 })
      .limit(limit)
      .populate('userId', 'nickname avatarUrl countryCode city isOfficial')
      .lean();

    const messages = rows
      .filter((m) => m.userId) // populate -> null if the user was deleted
      .map((m) => ({
        messageId: m._id.toString(),
        userId: m.userId._id.toString(),
        displayName: m.userId.nickname,
        avatarUrl: m.userId.avatarUrl ?? null,
        isOfficial: m.userId.isOfficial ?? false,
        countryCode: m.userId.countryCode ?? null,
        city: m.userId.city ?? null,
        body: m.body,
        createdAt: m.createdAt.toISOString(),
      }));

    ok(res, { messages });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/world-chat/report  { messageId, reason } ────────────────────────
router.post('/report', auth, async (req, res, next) => {
  try {
    const { messageId, reason } = req.body || {};
    if (!mongoose.isValidObjectId(messageId)) return err(res, 'Invalid messageId');
    const msg = await WorldChatMessage.findById(messageId).lean();
    await WorldChatReport.create({
      reporterId: req.user._id,
      messageId,
      reportedUserId: msg ? msg.userId : null,
      body: msg ? msg.body : '',
      reason: String(reason ?? '').slice(0, 300),
    });
    ok(res, { ok: true });
  } catch (e) {
    next(e);
  }
});

// ── Delete your OWN message ───────────────────────────────────────────────────
// Owner-only. Broadcasts the same world-chat:message-deleted event the admin
// path uses, so every client drops it live. (Single-segment path — never
// shadows the two-segment /admin/:messageId route.)
router.delete('/:messageId', auth, async (req, res, next) => {
  try {
    const { messageId } = req.params;
    if (!mongoose.isValidObjectId(messageId)) return err(res, 'Invalid messageId');
    const msg = await WorldChatMessage.findById(messageId);
    if (!msg) return err(res, 'Not found', 404);
    if (msg.userId.toString() !== req.user._id.toString()) return err(res, 'Not your message', 403);
    await WorldChatMessage.deleteOne({ _id: messageId });
    broadcast('world-chat:message-deleted', { messageId });
    ok(res, { ok: true });
  } catch (e) {
    next(e);
  }
});

// ── Admin: hard-delete a message ──────────────────────────────────────────────
router.delete('/admin/:messageId', requireAdminAuth, async (req, res, next) => {
  try {
    const { messageId } = req.params;
    if (!mongoose.isValidObjectId(messageId)) return err(res, 'Invalid messageId');
    await WorldChatMessage.deleteOne({ _id: messageId });
    broadcast('world-chat:message-deleted', { messageId });
    ok(res, { ok: true });
  } catch (e) {
    next(e);
  }
});

// ── Admin: ban a user ─────────────────────────────────────────────────────────
router.post('/admin/ban', requireAdminAuth, async (req, res, next) => {
  try {
    const { userId, reason } = req.body || {};
    if (!mongoose.isValidObjectId(userId)) return err(res, 'Invalid userId');
    await WorldChatBan.updateOne(
      { userId },
      { $set: { bannedBy: req.user?._id ?? null, reason: String(reason ?? '').slice(0, 300) } },
      { upsert: true },
    );
    ok(res, { ok: true });
  } catch (e) {
    if (e && e.code === 11000) return ok(res, { ok: true });
    next(e);
  }
});

// ── Admin: unban a user ───────────────────────────────────────────────────────
router.delete('/admin/ban/:userId', requireAdminAuth, async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) return err(res, 'Invalid userId');
    await WorldChatBan.deleteOne({ userId });
    ok(res, { ok: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
