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
const {
  ALL_ROOMS,
  COUNTRY_SUB_CHANNELS,
  VOICE_ROOMS,
  VALID_ROOM_IDS,
  CHANNEL_IDS,
  socketRoom,
  isCountryChannel,
  isValidChannel,
} = require('../config/worldChatRooms');
const { blockedIdSet } = require('../utils/blocking');
const User = require('../models/User');
const { isPremiumActive } = require('../utils/premium');
const { identityOf, levelOf } = require('../utils/identity');
const roomColors = require('../config/roomColors');
const { titleKeyForLevel } = require('../config/xpTable');
const xpService = require('../services/xpService');
const translateService = require('../services/translateService');

// Auto-translate daily character caps (cost management).
const TRANSLATE_LIMIT_FREE = 10000;
const TRANSLATE_LIMIT_PREMIUM = 100000;
const utcDay = () => new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
const translateLimitFor = (user) => (isPremiumActive(user) ? TRANSLATE_LIMIT_PREMIUM : TRANSLATE_LIMIT_FREE);
const usedTodayFor = (user) => {
  const u = user.translateUsage || {};
  return u.date === utcDay() ? u.chars || 0 : 0;
};

const BODY_MAX = 500;
const RATE_MS = 3000; // 1 message / 3s / user
const TITLE_MAX = 80;
const DESC_MAX = 300;
// Phase 4 spec §7.1 — simultaneous open rooms one user may own.
const MAX_ROOMS_FREE = 3;
const MAX_ROOMS_PREMIUM = 10;
const maxRoomsFor = (user) => (isPremiumActive(user) ? MAX_ROOMS_PREMIUM : MAX_ROOMS_FREE);

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

// Membership = creator OR in memberIds. Powers who may invite/see invitable.
const isRoomMember = (room, userId) =>
  sameId(room.creatorId, userId) || (room.memberIds || []).some((m) => sameId(m, userId));

// In-memory per-user daily invite quota (resets on UTC day rollover). Matches
// the in-process rate-limit philosophy used elsewhere — best-effort anti-spam,
// not a hard distributed guarantee.
const inviteQuota = new Map(); // userId -> { day, count }
function takeInviteQuota(userId, n) {
  const day = new Date().toISOString().slice(0, 10);
  const rec = inviteQuota.get(userId);
  if (!rec || rec.day !== day) {
    inviteQuota.set(userId, { day, count: n });
    return n <= INVITE_PER_DAY;
  }
  if (rec.count + n > INVITE_PER_DAY) return false;
  rec.count += n;
  return true;
}

/** Public room shape. Never leaks passwordHash. */
function serializeRoom(room, userId, onlineCount) {
  const c = room.creatorId;
  const creator =
    c && c._id ? { id: c._id.toString(), displayName: c.nickname, avatarUrl: c.avatarUrl ?? null } : { id: String(c) };
  return {
    id: room._id.toString(),
    channelId: room.channelId || room.countryCode || null,
    countryCode: room.countryCode,
    title: room.title,
    description: room.description || '',
    cardColor: room.cardColor || roomColors.DEFAULT_HEX,
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

// A one-line preview of a message for reply quotes + push bodies. Photos
// fall back to their caption, else a camera glyph.
function summarize(m) {
  if (!m) return '';
  if ((m.type || 'text') === 'photo') return (m.caption && m.caption.trim()) || '📷';
  if (m.type === 'voice') return '🎙️';
  return m.body || '';
}

// ── POST /api/world-chat/send ─────────────────────────────────────────────────
router.post('/send', auth, async (req, res, next) => {
  try {
    const isPhoto = req.body?.type === 'photo';
    const isVoice = req.body?.type === 'voice';
    const body = String(req.body?.body ?? '').trim();
    const caption = String(req.body?.caption ?? '').trim();
    const photoUrl = String(req.body?.photoUrl ?? '').trim();
    const voiceUrl = String(req.body?.voiceUrl ?? '').trim();
    const voiceDurationMs = Math.round(Number(req.body?.voiceDurationMs) || 0);
    const voiceWaveform = Array.isArray(req.body?.voiceWaveform)
      ? req.body.voiceWaveform.slice(0, 64).map((n) => Math.max(0, Math.min(1, Number(n) || 0)))
      : undefined;

    if (isPhoto) {
      if (!photoUrl) return err(res, 'photoUrl required for photo');
      if (caption.length > BODY_MAX) return err(res, `Caption too long (max ${BODY_MAX})`);
    } else if (isVoice) {
      if (!voiceUrl) return err(res, 'voiceUrl required for voice');
      if (voiceDurationMs < 300 || voiceDurationMs > 120000) return err(res, 'Invalid voice duration');
    } else {
      if (!body) return err(res, 'Message is empty');
      if (body.length > BODY_MAX) return err(res, `Message too long (max ${BODY_MAX})`);
    }

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

    // Content filter applies to the visible text (body for text, caption for photo).
    const filterTarget = isPhoto ? caption : body;
    if (filterTarget && BLOCKLIST.test(filterTarget)) return err(res, 'Message blocked by content filter', 422);

    const uid = req.user._id.toString();
    const now = Date.now();
    const prev = lastSent.get(uid) || 0;
    if (now - prev < RATE_MS) {
      return res.status(429).json({ error: 'Slow down', code: 'RATE_LIMIT' });
    }
    lastSent.set(uid, now);

    // Resolve an optional reply target — must be a real message (we quote its
    // sender + a snippet, and notify them). Ignored silently if it's gone.
    let replyDoc = null;
    const replyId = req.body?.replyToMessageId;
    if (replyId && mongoose.isValidObjectId(replyId)) {
      replyDoc = await WorldChatMessage.findById(replyId).populate('userId', 'nickname').lean();
    }
    const replyTo =
      replyDoc && replyDoc.userId
        ? {
            messageId: replyDoc._id.toString(),
            userId: replyDoc.userId._id.toString(),
            displayName: replyDoc.userId.nickname,
            type: replyDoc.type || 'text',
            body: summarize(replyDoc),
          }
        : null;

    const msg = await WorldChatMessage.create({
      userId: req.user._id,
      roomId,
      type: isPhoto ? 'photo' : isVoice ? 'voice' : 'text',
      body: isPhoto || isVoice ? '' : body,
      photoUrl: isPhoto ? photoUrl : null,
      caption: isPhoto ? caption || null : null,
      voiceUrl: isVoice ? voiceUrl : null,
      voiceDurationMs: isVoice ? voiceDurationMs : null,
      voiceWaveform: isVoice ? voiceWaveform : undefined,
      replyToMessageId: replyTo ? replyDoc._id : null,
    });

    // Keep the room list sortable + show activity.
    if (custom) {
      ChatRoom.updateOne({ _id: roomId }, { $inc: { messageCount: 1 }, $set: { lastActiveAt: new Date() } }).catch(() => {});
    }

    // Plaza Phase 4 §9.2 — award chat XP for text messages (anti-grind + caps
    // applied inside the service). Mutates req.user.level in place, so the
    // payload below reflects the post-award level + identity.
    const levelUp = msg.type === 'text' ? xpService.awardMessageXp(req.user, msg.body) : null;

    const payload = {
      messageId: msg._id.toString(),
      roomId,
      userId: uid,
      displayName: req.user.nickname,
      avatarUrl: req.user.avatarUrl ?? null,
      isOfficial: req.user.isOfficial ?? false,
      isVerified: req.user.isVerified ?? false,
      isPremium: isPremiumActive(req.user),
      identity: identityOf(req.user), // { tier, level } — §9.3 colors + §9.2 level
      countryCode: req.user.countryCode ?? null,
      city: req.user.city ?? null,
      body: msg.body,
      type: msg.type,
      photoUrl: msg.photoUrl ?? null,
      caption: msg.caption ?? null,
      voiceUrl: msg.voiceUrl ?? null,
      voiceDurationMs: msg.voiceDurationMs ?? null,
      voiceWaveform: msg.voiceWaveform ?? null,
      replyTo,
      createdAt: msg.createdAt.toISOString(),
    };
    broadcast('world-chat:receive', payload, roomId);
    created(res, payload);

    // §9.2.6 — on level-up, push a system line into the room everyone present sees.
    if (levelUp && levelUp.leveledUp) {
      broadcast(
        'world-chat:level-up',
        {
          roomId,
          userId: uid,
          userName: req.user.nickname || '',
          newLevel: levelUp.newLevel,
          titleKey: levelUp.titleKey || titleKeyForLevel(levelUp.newLevel),
        },
        roomId,
      );
    }

    // Push the original sender when someone replies to them (not on self-reply).
    // notify() respects per-user opt-out (world_chat_reply isn't high-priority).
    if (replyTo && replyTo.userId !== uid) {
      const name = req.user.nickname || '';
      const snippet = summarize(msg).slice(0, 80);
      notify(replyTo.userId, 'world_chat_reply', {
        i18n: {
          en: { title: name, body: `Replied to you: ${snippet}` },
          zh: { title: name, body: `回复了你：${snippet}` },
          ko: { title: name, body: `회원님에게 답장했습니다: ${snippet}` },
          ja: { title: name, body: `あなたに返信しました: ${snippet}` },
        },
        data: {
          roomId,
          custom: custom ? '1' : '0',
          messageId: msg._id.toString(),
          fromUserId: uid,
          fromUserName: name,
          fromUserAvatarUrl: req.user.avatarUrl || '',
        },
      }).catch(() => {});
    }
  } catch (e) {
    next(e);
  }
});

// A bare country room (e.g. 'MY') is a country *identity* used to build the
// country picker — you never chat in it directly; entering a country lands you
// in its `country:my:general` sub-channel. So 热门 ranks over everything EXCEPT
// the bare country rooms (the global 'world' lobby is kept).
const inHotPool = (r) => !(r.kind === 'country' && r.id !== 'world');

// 30s cache for the 热门 ordering. Counts come from the in-memory socket adapter
// (no DB hit), and live socket `rooms-state` events keep clients fresh between
// fetches — so a short cache on the REST seed is safe + cheap.
let hotCache = { at: 0, limit: null, rooms: null };
const HOT_TTL = 30_000;

// ── GET /api/world-chat/rooms ─────────────────────────────────────────────────
// Available rooms (countries + 🔥 topic rooms + 🎮 interest channels + 🌏 country
// sub-channels) + live online counts (from the socket adapter). Each room
// carries a `kind` ('topic' | 'country' | 'interest' | 'country-sub') so the
// client can group them across the Plaza tabs. The response also includes
// `voiceRooms` (display-only 🎤 placeholders) and `subChannels` (the 4 country
// sub-channel definitions) so the client renders those tabs from one source.
//
// Pass `?sort=hot` (optionally `&limit=5`) for the 🔥 热门 view: a pure ranking
// of all rooms by live online count desc, top N. Counts come straight from the
// in-memory socket adapter — cached 30s.
router.get('/rooms', auth, async (req, res, next) => {
  try {
    let counts = {};
    try {
      counts = require('../services/socketService').getRoomCounts();
    } catch (_) {
      // socket layer not ready
    }
    const mapRoom = (r) => ({
      id: r.id,
      flag: r.flag,
      label: r.label,
      kind: r.kind,
      ...(r.i18nKey ? { i18nKey: r.i18nKey } : {}),
      ...(r.country ? { country: r.country, sub: r.sub, countryLabel: r.countryLabel } : {}),
      onlineCount: counts[r.id] ?? 0,
    });

    const voiceRooms = VOICE_ROOMS.map((v) => ({ id: v.id, emoji: v.emoji, i18nKey: v.i18nKey }));
    const subChannels = COUNTRY_SUB_CHANNELS.map((s) => ({ key: s.key, emoji: s.emoji, i18nKey: s.i18nKey }));

    if (req.query.sort === 'hot') {
      const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 0, 0), 50) || null;
      const fresh = Date.now() - hotCache.at < HOT_TTL && hotCache.limit === limit && hotCache.rooms;
      if (!fresh) {
        const ranked = ALL_ROOMS.filter(inHotPool).map(mapRoom);
        // §6.1 — user-created rooms compete in the same hot pool. Include public,
        // open UGC rooms that currently have someone online (recent activity
        // first as the candidate set, then filtered by live count).
        try {
          const ugc = await ChatRoom.find({ status: 'open', isPrivate: false })
            .select('title')
            .sort({ lastActiveAt: -1 })
            .limit(80)
            .lean();
          for (const r of ugc) {
            const id = r._id.toString();
            const onlineCount = roomCount(id);
            if (onlineCount > 0) {
              ranked.push({ id, flag: '💬', label: { en: r.title, zh: r.title, native: r.title }, kind: 'ugc', onlineCount });
            }
          }
        } catch (_) {
          /* UGC merge is best-effort */
        }
        ranked.sort((a, b) => b.onlineCount - a.onlineCount);
        hotCache = { at: Date.now(), limit, rooms: limit ? ranked.slice(0, limit) : ranked };
      }
      return ok(res, { rooms: hotCache.rooms, voiceRooms, subChannels });
    }

    ok(res, { rooms: ALL_ROOMS.map(mapRoom), voiceRooms, subChannels });
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

// Create a room inside a 二级频道 (country code or friend:/voice:/interest: id).
// Creator auto-joins. Phase 4 §7: per-user quota (Free 3 / Premium 10), title +
// description sensitive-word filtered (§7.6).
router.post('/rooms', auth, async (req, res, next) => {
  try {
    const { channelId, countryCode, title, description, isPrivate, password } = req.body || {};
    // Prefer channelId; fall back to legacy countryCode for older clients.
    const channel = channelId || countryCode;
    if (!isValidChannel(channel)) return err(res, 'Invalid channel');
    const ttl = String(title ?? '').trim();
    if (!ttl) return err(res, 'Title is required');
    if (ttl.length < 2) return err(res, 'Title too short (min 2)');
    if (ttl.length > TITLE_MAX) return err(res, `Title too long (max ${TITLE_MAX})`);
    const desc = String(description ?? '').trim().slice(0, DESC_MAX);
    // §7.6 — block names/descriptions that hit the sensitive-word filter.
    if (BLOCKLIST.test(ttl) || (desc && BLOCKLIST.test(desc))) {
      return err(res, 'Room name contains disallowed words', 422);
    }
    const priv = !!isPrivate;
    if (priv && !String(password ?? '').trim()) return err(res, 'Private rooms need a password');

    // 自建房颜色 — must be a palette color the creator has unlocked by level
    // (defaults to Lv1 灰白 when omitted). Reject locked/unknown colors.
    const cardColor = String(req.body?.cardColor ?? '').trim() || roomColors.DEFAULT_HEX;
    if (!roomColors.isUnlocked(cardColor, levelOf(req.user))) {
      return res.status(403).json({ error: 'Color not unlocked yet', code: 'COLOR_LOCKED' });
    }

    const owned = await ChatRoom.countDocuments({ creatorId: req.user._id, status: 'open' });
    const cap = maxRoomsFor(req.user);
    if (owned >= cap) {
      return res.status(429).json({ error: `You can own at most ${cap} open rooms`, code: 'ROOM_LIMIT', cap });
    }

    const room = await ChatRoom.create({
      creatorId: req.user._id,
      channelId: channel,
      // Mirror to countryCode for countries so legacy reads still resolve.
      countryCode: isCountryChannel(channel) ? channel : undefined,
      title: ttl,
      description: desc,
      cardColor,
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

// List the user-created (UGC) rooms inside a 二级频道. The channel's fixed
// 总聊天室 / sub-boards are config-driven and rendered client-side; this returns
// only the UGC rooms. Public-open rooms to everyone; private/closed only to
// members or the creator. Sorted by live online count desc, then newest first
// (spec §5.4 / §7.3) — online ranking is applied after the DB fetch since counts
// live in the socket adapter.
async function listChannelRooms(channel, userId, res, next) {
  try {
    if (!isValidChannel(channel)) return err(res, 'Invalid channel');
    // Match new channelId rooms AND legacy country rooms that only set countryCode.
    const parentMatch = isCountryChannel(channel)
      ? { $or: [{ channelId: channel }, { channelId: { $in: [null, undefined] }, countryCode: channel }] }
      : { channelId: channel };
    const rooms = await ChatRoom.find({
      $and: [
        parentMatch,
        { $or: [{ isPrivate: false }, { memberIds: userId }, { creatorId: userId }] },
        { $or: [{ status: 'open' }, { memberIds: userId }, { creatorId: userId }] },
      ],
    })
      .populate('creatorId', 'nickname avatarUrl')
      .sort({ lastActiveAt: -1 })
      .limit(100)
      .lean();
    const serialized = rooms
      .map((r) => serializeRoom(r, userId, roomCount(r._id.toString())))
      // §7.3 — online desc, then createdAt desc (newest first).
      .sort((a, b) => b.onlineCount - a.onlineCount || new Date(b.createdAt) - new Date(a.createdAt));
    ok(res, { rooms: serialized });
  } catch (e) {
    next(e);
  }
}

// Phase 4 canonical listing — any channel.
router.get('/rooms/by-channel/:channelId', auth, (req, res, next) =>
  listChannelRooms(req.params.channelId, req.user._id, res, next),
);

// Legacy alias — country rooms (pre-Phase-4 clients).
router.get('/rooms/by-country/:countryCode', auth, (req, res, next) =>
  listChannelRooms(req.params.countryCode, req.user._id, res, next),
);

// 我开的房间 — the current user's own open rooms across all channels (Phase 4
// §6.3 热门 page). Includes the quota cap so the client can show "3/3 used".
// Declared before '/rooms/:id' so the literal 'mine' segment isn't swallowed.
router.get('/rooms/mine', auth, async (req, res, next) => {
  try {
    const rooms = await ChatRoom.find({ creatorId: req.user._id, status: 'open' })
      .populate('creatorId', 'nickname avatarUrl')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    ok(res, {
      rooms: rooms.map((r) => serializeRoom(r, req.user._id, roomCount(r._id.toString()))),
      cap: maxRoomsFor(req.user),
      isPremium: isPremiumActive(req.user),
    });
  } catch (e) {
    next(e);
  }
});

// Friends invitable to a room (my follows ∪ followers, minus members). Any
// member — not just the creator — can pull friends in (viral growth). Online
// friends are surfaced first so the picker leads with who's reachable now.
router.get('/rooms/:id/invitable', auth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return err(res, 'Invalid id');
    const room = await ChatRoom.findById(req.params.id).select('creatorId memberIds');
    if (!room) return err(res, 'Room not found', 404);
    if (!isRoomMember(room, req.user._id)) return err(res, 'Join the room first', 403);
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
      .select('nickname avatarUrl isOnline lastActiveAt isOfficial isVerified isPremium premiumExpiresAt vipLevel vipExpiresAt')
      .lean();
    const friends = users
      .map((u) => ({
        id: u._id.toString(),
        displayName: u.nickname,
        avatarUrl: u.avatarUrl ?? null,
        isOnline: !!u.isOnline,
        lastActiveAt: u.lastActiveAt ? u.lastActiveAt.toISOString() : null,
        isOfficial: u.isOfficial ?? false,
        isVerified: u.isVerified ?? false,
        isPremium: isPremiumActive(u),
      }))
      // Online first, then most-recently-active.
      .sort((a, b) => {
        if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
        return (b.lastActiveAt || '').localeCompare(a.lastActiveAt || '');
      });
    ok(res, { friends });
  } catch (e) {
    next(e);
  }
});

// Member list (visible to any member or the creator). Powers the kick UI.
router.get('/rooms/:id/members', auth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return err(res, 'Invalid id');
    const room = await ChatRoom.findById(req.params.id).populate(
      'memberIds',
      'nickname avatarUrl isOfficial isVerified isPremium premiumExpiresAt vipLevel vipExpiresAt',
    );
    if (!room) return err(res, 'Room not found', 404);
    const isMember = room.memberIds.some((m) => sameId(m, req.user._id));
    if (!isMember && !sameId(room.creatorId, req.user._id)) return err(res, 'Join the room first', 403);
    ok(res, {
      members: room.memberIds.map((m) => ({
        id: m._id.toString(),
        displayName: m.nickname,
        avatarUrl: m.avatarUrl ?? null,
        isOfficial: m.isOfficial ?? false,
        isVerified: m.isVerified ?? false,
        isPremium: isPremiumActive(m),
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

// Any member invites friends (people they follow or who follow them). Invitees
// are added to the room and pinged with a localized push that deep-links in.
const INVITE_PER_REQUEST = 20; // matches the client's multi-select cap
const INVITE_PER_DAY = 60; // soft anti-spam ceiling per inviter per day
router.post('/rooms/:id/invite', auth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return err(res, 'Invalid id');
    const room = await ChatRoom.findById(req.params.id).select('creatorId memberIds title status');
    if (!room) return err(res, 'Room not found', 404);
    if (room.status === 'closed') return err(res, 'This room is closed', 403);
    if (!isRoomMember(room, req.user._id)) return err(res, 'Join the room first', 403);
    let ids = Array.isArray(req.body?.userIds) ? req.body.userIds.filter((x) => mongoose.isValidObjectId(x)) : [];
    ids = [...new Set(ids.map(String))].slice(0, INVITE_PER_REQUEST);
    if (!ids.length) return err(res, 'No users to invite');
    if (!takeInviteQuota(req.user._id.toString(), ids.length)) {
      return err(res, 'Daily invite limit reached — try again tomorrow', 429);
    }
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
    const inviter = req.user.nickname || 'A friend';
    for (const uid of toAdd) {
      broadcastToUser(uid, 'world-chat:room-invited', { roomId: room._id.toString(), title: room.title });
      notify(uid, 'room_invite', {
        body: '点击加入聊天',
        data: {
          roomId: room._id.toString(),
          custom: '1',
          fromUserName: req.user.nickname || '',
          fromUserAvatarUrl: req.user.avatarUrl || '',
        },
        i18n: {
          en: { title: `${inviter} invited you to “${room.title}”`, body: 'Tap to join the chat' },
          zh: { title: `${inviter} 邀请你进入「${room.title}」`, body: '点击加入聊天' },
          ko: { title: `${inviter}님이 “${room.title}” 채팅방에 초대했어요`, body: '탭하여 참여하기' },
          ja: { title: `${inviter}さんが「${room.title}」に招待しました`, body: 'タップして参加' },
        },
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
    if (b.cardColor !== undefined) {
      const hex = String(b.cardColor).trim();
      if (!roomColors.isUnlocked(hex, levelOf(req.user))) {
        return res.status(403).json({ error: 'Color not unlocked yet', code: 'COLOR_LOCKED' });
      }
      room.cardColor = hex;
    }
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
    // Symmetric (mutual) block — hide messages from anyone the viewer blocked OR
    // who blocked them.
    const blocked = await blockedIdSet(req.user);
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
      .populate(
        'userId',
        'nickname avatarUrl countryCode city isOfficial isVerified level currentExp isPremium premiumExpiresAt vipLevel vipExpiresAt',
      )
      .populate({ path: 'replyToMessageId', select: 'body type caption userId', populate: { path: 'userId', select: 'nickname' } })
      .lean();

    const messages = rows
      .filter((m) => m.userId) // populate -> null if the user was deleted
      .map((m) => {
        const r = m.replyToMessageId;
        const replyTo =
          r && r.userId
            ? {
                messageId: r._id.toString(),
                userId: r.userId._id.toString(),
                displayName: r.userId.nickname,
                type: r.type || 'text',
                body: summarize(r),
              }
            : null;
        return {
          messageId: m._id.toString(),
          userId: m.userId._id.toString(),
          displayName: m.userId.nickname,
          avatarUrl: m.userId.avatarUrl ?? null,
          isOfficial: m.userId.isOfficial ?? false,
          isVerified: m.userId.isVerified ?? false,
          isPremium: isPremiumActive(m.userId),
          identity: identityOf(m.userId),
          countryCode: m.userId.countryCode ?? null,
          city: m.userId.city ?? null,
          body: m.body,
          type: m.type || 'text',
          photoUrl: m.photoUrl ?? null,
          caption: m.caption ?? null,
          replyTo,
          createdAt: m.createdAt.toISOString(),
        };
      });

    ok(res, { messages });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/world-chat/translate/quota ───────────────────────────────────────
// Current user's daily auto-translate usage. Drives the Settings quota bar.
router.get('/translate/quota', auth, (req, res) => {
  const limit = translateLimitFor(req.user);
  const used = usedTodayFor(req.user);
  ok(res, {
    used,
    limit,
    percent: limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0,
    isPremium: isPremiumActive(req.user),
  });
});

// ── POST /api/world-chat/translate  { messageId, to } ─────────────────────────
// Lazily translate one world-chat message into `to` (en/zh/ko/ja), caching the
// result on the message doc so repeat reads are free. Country rooms + world
// lobby only — private DMs are never translated.
router.post('/translate', auth, async (req, res, next) => {
  try {
    const { messageId } = req.body || {};
    const to = String(req.body?.to || '').toLowerCase();
    if (!mongoose.isValidObjectId(messageId)) return err(res, 'Invalid messageId');
    if (!translateService.SUPPORTED.has(to)) return err(res, 'Unsupported target language');
    if (!translateService.isConfigured()) return err(res, 'Translation unavailable', 503);

    const msg = await WorldChatMessage.findById(messageId);
    if (!msg) return err(res, 'Message not found', 404);

    const original = (msg.body || '').trim();
    // Nothing to translate (photo/voice/empty) — answer without touching the API.
    if (!original || (msg.type && msg.type !== 'text')) {
      return ok(res, { original: msg.body || '', detectedLang: msg.detectedLang || null, translated: null, to });
    }

    // Cache hit — '' means "source already equals target" (no line to show).
    const cached = msg.translations && msg.translations.get(to);
    if (cached != null) {
      return ok(res, { original, detectedLang: msg.detectedLang || null, translated: cached || null, to });
    }
    // Known-same language from a prior call (different target detected the source).
    if (msg.detectedLang && msg.detectedLang === to) {
      return ok(res, { original, detectedLang: to, translated: null, to });
    }

    // Daily quota gate (chars actually sent to Google).
    const today = utcDay();
    const used = usedTodayFor(req.user);
    const limit = translateLimitFor(req.user);
    if (used + original.length > limit) {
      return res.status(429).json({ error: 'Daily translation limit reached', code: 'TRANSLATE_QUOTA' });
    }

    let result;
    try {
      result = await translateService.translate(original, to);
    } catch (_) {
      return err(res, 'Translation failed', 502);
    }

    msg.detectedLang = result.detectedSourceLanguage || msg.detectedLang || null;
    const sameLang = msg.detectedLang === to;
    if (!msg.translations) msg.translations = new Map();
    msg.translations.set(to, sameLang ? '' : result.translatedText);
    await msg.save();

    // Charge quota only on a real API call.
    await User.updateOne(
      { _id: req.user._id },
      { $set: { 'translateUsage.date': today, 'translateUsage.chars': used + original.length } },
    );

    ok(res, {
      original,
      detectedLang: msg.detectedLang,
      translated: sameLang ? null : result.translatedText,
      to,
    });
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
