// Plaza Phase 3 — random matchmaking (❤️ 随机聊天) + daily hot leaderboards.
//
// Matchmaking pairs two waiting users into an EPHEMERAL 1-on-1 chat. Nothing is
// persisted: the queue row is deleted the instant a partner is claimed, and the
// live session lives only in the in-memory `sessions` map (30-min TTL). Chat
// messages are relayed over WS and never written to Mongo — close the screen and
// the conversation is gone.
const router = require('express').Router();
const crypto = require('crypto');
const User = require('../models/User');
const Follow = require('../models/Follow');
const MatchmakingQueue = require('../models/MatchmakingQueue');
const WorldChatMessage = require('../models/WorldChatMessage');
const { auth } = require('../middleware/auth');
const { ok, err } = require('../utils/respond');
const { notify } = require('../services/notificationService');
const { NOT_OFFICIAL } = require('../utils/discovery');
const { ROOMS } = require('../config/worldChatRooms');
const { computeRoleTag, isPremiumActive, ROLE_TAG_FIELDS } = require('../utils/roleTag');

// ── In-memory session store ───────────────────────────────────────────────────
// sessionId → { a, b, createdAt }  (a, b are userId strings)
const sessions = new Map();
const SESSION_TTL_MS = 30 * 60 * 1000;

function makeSession(a, b) {
  const id = crypto.randomUUID();
  sessions.set(id, { a, b, createdAt: Date.now() });
  return id;
}
function partnerOf(session, userId) {
  return session.a === userId ? session.b : session.a;
}
function sessionFor(sessionId, userId) {
  const s = sessions.get(sessionId);
  if (!s || (s.a !== userId && s.b !== userId)) return null;
  return s;
}

// Sweep expired sessions (client crashed / never sent end).
setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (now - s.createdAt > SESSION_TTL_MS) sessions.delete(id);
  }
}, 60 * 1000).unref?.();

function emitToUser(userId, event, payload) {
  try {
    require('../services/socketService').getIO().to(`user:${userId}`).emit(event, payload);
  } catch {
    /* socket not ready / user offline — best effort */
  }
}

// ── Filters (Premium only) ────────────────────────────────────────────────────
function clampAge(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  return Math.min(99, Math.max(18, Math.round(v)));
}
function sanitizeFilters(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const f = {};
  const min = clampAge(raw.ageMin);
  const max = clampAge(raw.ageMax);
  if (min != null) f.ageMin = min;
  if (max != null) f.ageMax = max;
  if (typeof raw.countryCode === 'string' && raw.countryCode.trim()) {
    f.countryCode = raw.countryCode.trim().toUpperCase().slice(0, 2);
  }
  if (typeof raw.gender === 'string' && raw.gender.trim()) f.gender = raw.gender.trim().slice(0, 20);
  if (typeof raw.language === 'string' && raw.language.trim()) f.language = raw.language.trim().slice(0, 10);
  return f;
}
function attrsOf(user) {
  return {
    age: user.age ?? null,
    countryCode: user.countryCode ?? null,
    gender: user.gender ?? null,
    language: user.preferences?.preferredLanguage ?? null,
  };
}
// Build a Mongo constraint on queue `attrs` from MY filters.
function filtersToQuery(query, f) {
  if (f.ageMin != null || f.ageMax != null) {
    query['attrs.age'] = {};
    if (f.ageMin != null) query['attrs.age'].$gte = f.ageMin;
    if (f.ageMax != null) query['attrs.age'].$lte = f.ageMax;
  }
  if (f.countryCode) query['attrs.countryCode'] = f.countryCode;
  if (f.gender) query['attrs.gender'] = f.gender;
  if (f.language) query['attrs.language'] = f.language;
}
// Do MY attributes satisfy a candidate's filters? (JS-side reverse check.)
function attrsSatisfy(attrs, f) {
  if (!f) return true;
  if (f.ageMin != null && (attrs.age == null || attrs.age < f.ageMin)) return false;
  if (f.ageMax != null && (attrs.age == null || attrs.age > f.ageMax)) return false;
  if (f.countryCode && attrs.countryCode !== f.countryCode) return false;
  if (f.gender && attrs.gender !== f.gender) return false;
  if (f.language && attrs.language !== f.language) return false;
  return true;
}

function publicPartner(userDoc) {
  if (!userDoc) return null;
  const p = userDoc.toPublicJSON(undefined, { self: false });
  // Slim payload — the random-chat header only needs identity + role dot.
  return {
    id: p.id,
    nickname: p.nickname,
    avatarUrl: p.avatarUrl ?? null,
    age: p.age ?? null,
    countryCode: p.countryCode ?? null,
    city: p.city ?? null,
    roleTag: p.roleTag,
    roleColor: p.roleColor,
    isOnline: p.isOnline ?? false,
  };
}

// ── POST /api/plaza/match/join ────────────────────────────────────────────────
// Join the queue. If a compatible partner is already waiting, pair instantly
// (returns { matched:true, sessionId, partner }) and pushes match:found to them.
// Otherwise enqueue and return { matched:false }; the client waits for the
// match:found WS event fired when the next seeker arrives.
router.post('/match/join', auth, async (req, res, next) => {
  try {
    const me = req.user;
    const myId = me._id.toString();

    // Drop any stale self entry before searching.
    await MatchmakingQueue.deleteOne({ userId: me._id });

    const myFilters = isPremiumActive(me) ? sanitizeFilters(req.body?.filters) : {};
    const myAttrs = attrsOf(me);

    const candQuery = { userId: { $ne: me._id } };
    filtersToQuery(candQuery, myFilters);

    const candidates = await MatchmakingQueue.find(candQuery).sort({ createdAt: 1 }).limit(25).lean();

    for (const cand of candidates) {
      if (!attrsSatisfy(myAttrs, cand.filters)) continue; // their filters reject me
      // Atomically claim — loses the race gracefully if another seeker grabbed them.
      const claimed = await MatchmakingQueue.findOneAndDelete({ _id: cand._id });
      if (!claimed) continue;

      const partner = await User.findById(claimed.userId).select(
        `nickname avatarUrl age countryCode city isOnline preferences ${ROLE_TAG_FIELDS}`,
      );
      if (!partner) continue; // vanished — try next candidate

      const sessionId = makeSession(myId, claimed.userId.toString());
      // Tell the waiting partner they've been matched (I am their partner).
      emitToUser(claimed.userId, 'match:found', { sessionId, partner: publicPartner(me) });
      return ok(res, { matched: true, sessionId, partner: publicPartner(partner) });
    }

    // No one waiting — enqueue and wait for a future seeker.
    await MatchmakingQueue.create({ userId: me._id, attrs: myAttrs, filters: myFilters });
    return ok(res, { matched: false });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/plaza/match/cancel ──────────────────────────────────────────────
// Stop searching (left the queue without a match).
router.post('/match/cancel', auth, async (req, res, next) => {
  try {
    await MatchmakingQueue.deleteOne({ userId: req.user._id });
    ok(res, { cancelled: true });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/plaza/match/:sessionId/send ─────────────────────────────────────
// Relay an ephemeral text message to the partner over WS. Not persisted.
router.post('/match/:sessionId/send', auth, async (req, res, next) => {
  try {
    const myId = req.user._id.toString();
    const session = sessionFor(req.params.sessionId, myId);
    if (!session) return err(res, 'Session not found', 404);

    const body = String(req.body?.body ?? '').trim();
    if (!body) return err(res, 'Empty message', 400);
    if (body.length > 2000) return err(res, 'Message too long', 400);

    const payload = {
      sessionId: req.params.sessionId,
      messageId: crypto.randomUUID(),
      senderId: myId,
      body,
      createdAt: new Date().toISOString(),
    };
    emitToUser(partnerOf(session, myId), 'match:receive', payload);
    ok(res, payload); // sender inserts from the HTTP echo (no self WS to avoid dupes)
  } catch (e) {
    next(e);
  }
});

// ── POST /api/plaza/match/:sessionId/typing ───────────────────────────────────
router.post('/match/:sessionId/typing', auth, async (req, res, next) => {
  try {
    const myId = req.user._id.toString();
    const session = sessionFor(req.params.sessionId, myId);
    if (!session) return err(res, 'Session not found', 404);
    emitToUser(partnerOf(session, myId), 'match:typing', {
      sessionId: req.params.sessionId,
      fromUserId: myId,
      typing: !!req.body?.typing,
    });
    ok(res, { ok: true });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/plaza/match/:sessionId/end ──────────────────────────────────────
// Leave the session (Exit, or before Next). Notifies the partner.
router.post('/match/:sessionId/end', auth, async (req, res, next) => {
  try {
    const myId = req.user._id.toString();
    const session = sessions.get(req.params.sessionId);
    if (session && (session.a === myId || session.b === myId)) {
      emitToUser(partnerOf(session, myId), 'match:ended', { sessionId: req.params.sessionId });
      sessions.delete(req.params.sessionId);
    }
    ok(res, { ended: true });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/plaza/match/:sessionId/add-friend ───────────────────────────────
// Convert the random match into a follow (idempotent).
router.post('/match/:sessionId/add-friend', auth, async (req, res, next) => {
  try {
    const myId = req.user._id.toString();
    const session = sessionFor(req.params.sessionId, myId);
    if (!session) return err(res, 'Session not found', 404);
    const partnerId = partnerOf(session, myId);

    const existing = await Follow.findOne({ follower: req.user._id, following: partnerId });
    if (existing) return ok(res, { following: true, already: true });

    await Follow.create({ follower: req.user._id, following: partnerId });
    await User.findByIdAndUpdate(req.user._id, { $inc: { followingCount: 1 } });
    await User.findByIdAndUpdate(partnerId, { $inc: { followersCount: 1 } });

    const who = req.user.nickname || 'Someone';
    notify(partnerId, 'follow', {
      title: `${who} is following you`,
      body: '',
      data: { type: 'follow', userId: myId },
    }).catch(() => {});

    ok(res, { following: true });
  } catch (e) {
    next(e);
  }
});

// ── Daily hot leaderboards ────────────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function startOfTodayUTC() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function userEntry(u, rank, source) {
  return {
    rank,
    source,
    ticketCount: u.dailyTicketsReceived ?? 0,
    user: {
      id: u._id.toString(),
      nickname: u.nickname,
      avatarUrl: u.avatarUrl ?? null,
      countryCode: u.countryCode ?? null,
      age: u.age ?? null,
      isBoosted: u.isBoosted ?? false,
      isPremium: u.isPremium ?? false,
      popularityScore: u.popularityScore ?? 0,
      roleTag: computeRoleTag(u),
    },
  };
}

// GET /api/plaza/leaderboard/users?period=today — top users by tickets today.
router.get('/leaderboard/users', auth, async (req, res, next) => {
  try {
    const today = todayStr();
    const SELECT = `nickname avatarUrl countryCode isBoosted isPremium age popularityScore dailyTicketsReceived ${ROLE_TAG_FIELDS}`;

    const top = await User.find({
      dailyTicketsDate: today,
      dailyTicketsReceived: { $gt: 0 },
      'preferences.hideFromNearby': { $ne: true },
      ...NOT_OFFICIAL,
    })
      .sort({ dailyTicketsReceived: -1 })
      .limit(20)
      .select(SELECT)
      .lean();

    const entries = top.map((u, i) => userEntry(u, i + 1, 'ticket'));

    // Fill up to 20 with the most popular users not already ranked.
    if (entries.length < 20) {
      const excludeIds = top.map((u) => u._id);
      const filler = await User.find({
        _id: { $nin: excludeIds },
        'preferences.hideFromNearby': { $ne: true },
        'preferences.stealthMode': { $ne: true },
        ...NOT_OFFICIAL,
      })
        .sort({ popularityScore: -1, lastActiveAt: -1 })
        .limit(20 - entries.length)
        .select(SELECT)
        .lean();
      filler.forEach((u) => entries.push(userEntry(u, entries.length + 1, 'system')));
    }

    ok(res, entries);
  } catch (e) {
    next(e);
  }
});

// GET /api/plaza/leaderboard/rooms?period=today — busiest rooms today by
// message volume + distinct speakers, annotated with the live online count.
router.get('/leaderboard/rooms', auth, async (req, res, next) => {
  try {
    const start = startOfTodayUTC();
    const agg = await WorldChatMessage.aggregate([
      { $match: { createdAt: { $gte: start } } },
      {
        $group: {
          _id: { $ifNull: ['$roomId', 'world'] },
          messages: { $sum: 1 },
          speakers: { $addToSet: '$userId' },
        },
      },
    ]);

    const byId = {};
    for (const a of agg) byId[a._id] = { messages: a.messages, speakers: a.speakers.length };

    let counts = {};
    try {
      counts = require('../services/socketService').getRoomCounts();
    } catch {
      counts = {};
    }

    const entries = ROOMS.map((r) => ({
      roomId: r.id,
      flag: r.flag,
      label: { en: r.en, zh: r.zh, native: r.native },
      messages: byId[r.id]?.messages ?? 0,
      speakers: byId[r.id]?.speakers ?? 0,
      onlineCount: counts[r.id] ?? 0,
    }));

    entries.sort((a, b) => b.messages - a.messages || b.onlineCount - a.onlineCount);
    entries.forEach((e, i) => (e.rank = i + 1));

    ok(res, entries);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
