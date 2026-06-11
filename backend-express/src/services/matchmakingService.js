// Random 1-on-1 matchmaking (Plaza Phase 3 — "❤️ 随机聊天").
//
// The *waiting* queue is persisted (MatchmakingQueue, with a TTL) so a closed
// client never strands a row. The *matched* sessions are ephemeral and live
// only in this process's memory — a session disappears the moment either party
// leaves, taps "Next", or disconnects. Messages are relayed peer-to-peer over
// WS and never stored.
//
// Single-instance backend (Render) → in-memory session state is safe. If the
// app is ever horizontally scaled, sessions would need to move to Redis.

const crypto = require('crypto');
const MatchmakingQueue = require('../models/MatchmakingQueue');
const User = require('../models/User');
const { computeAge } = require('../utils/zodiac');
const { computeRole } = require('../utils/role');

const SESSION_TTL_MS = 30 * 60 * 1000; // ephemeral sessions die after 30 min idle

/** @type {Map<string, {id:string, users:string[], createdAt:number, lastActivity:number}>} */
const sessions = new Map();
/** @type {Map<string, string>} userId → sessionId */
const userToSession = new Map();

function io() {
  return require('./socketService').getIO();
}
function emitToUser(userId, event, payload) {
  try {
    io().to(`user:${userId}`).emit(event, payload);
  } catch (_) {
    // socket layer not ready / no clients — non-fatal.
  }
}

/** Matchable attribute snapshot for a user doc. */
function attrsOf(user) {
  return {
    age: computeAge(user.dob) ?? user.age ?? null,
    countryCode: user.countryCode ?? null,
    language: user.preferredLanguage ?? null,
  };
}

/** Public partner card shown on the "match found" screen. */
function partnerCard(user) {
  return {
    id: user._id.toString(),
    nickname: user.nickname,
    avatarUrl: user.avatarUrl ?? null,
    age: computeAge(user.dob) ?? user.age ?? null,
    countryCode: user.countryCode ?? null,
    city: user.city ?? null,
    role: computeRole(user),
  };
}

/** Does `attrs` satisfy `filters`? Empty/absent filters → always yes (free). */
function attrsSatisfy(filters, attrs) {
  if (!filters) return true;
  if (filters.ageMin != null && (attrs.age == null || attrs.age < filters.ageMin)) return false;
  if (filters.ageMax != null && (attrs.age == null || attrs.age > filters.ageMax)) return false;
  if (filters.countryCode && attrs.countryCode !== filters.countryCode) return false;
  if (filters.language && attrs.language !== filters.language) return false;
  return true;
}

function newSession(a, b) {
  const id = crypto.randomUUID();
  const now = Date.now();
  sessions.set(id, { id, users: [a, b], createdAt: now, lastActivity: now });
  userToSession.set(a, id);
  userToSession.set(b, id);
  return id;
}

function partnerOf(sessionId, userId) {
  const s = sessions.get(sessionId);
  if (!s) return null;
  return s.users.find((u) => u !== userId) ?? null;
}

/**
 * Join matchmaking. Returns one of:
 *   { status: 'matched', sessionId, partner }   — paired immediately
 *   { status: 'waiting' }                        — queued, will get WS match:found
 * The partner (who was already waiting) is notified via WS 'match:found'.
 */
async function join(user, filters = {}) {
  const userId = user._id.toString();

  // Idempotent reconnect: already in a live session.
  const existing = userToSession.get(userId);
  if (existing && sessions.has(existing)) {
    const partnerId = partnerOf(existing, userId);
    const partner = partnerId ? await User.findById(partnerId).lean() : null;
    return { status: 'matched', sessionId: existing, partner: partner ? partnerCard(partner) : null };
  }

  const myAttrs = attrsOf(user);
  const cleanFilters = sanitizeFilters(filters);

  // Never sit in the queue twice.
  await MatchmakingQueue.deleteOne({ userId }).catch(() => {});

  // Find the oldest compatible waiting partner (both directions must agree).
  const waiting = await MatchmakingQueue.find({ userId: { $ne: userId } })
    .sort({ joinedAt: 1 })
    .lean();

  for (const w of waiting) {
    const partnerId = w.userId.toString();
    if (userToSession.has(partnerId)) continue; // already matched elsewhere
    if (!attrsSatisfy(cleanFilters, w.attrs)) continue; // my filter vs them
    if (!attrsSatisfy(w.filters, myAttrs)) continue; // their filter vs me

    // Claim the partner: remove from queue. If already gone (race), skip.
    const claimed = await MatchmakingQueue.findOneAndDelete({ userId: partnerId });
    if (!claimed) continue;

    const partnerUser = await User.findById(partnerId).lean();
    if (!partnerUser) continue; // deleted between queue + match

    const sessionId = newSession(userId, partnerId);

    // Tell the waiting partner over WS; the joiner gets it in the HTTP reply.
    emitToUser(partnerId, 'match:found', {
      sessionId,
      partnerId: userId,
      partner: partnerCard(user),
    });

    return { status: 'matched', sessionId, partner: partnerCard(partnerUser) };
  }

  // No compatible partner — wait.
  await MatchmakingQueue.updateOne(
    { userId },
    { $set: { userId, filters: cleanFilters, attrs: myAttrs, joinedAt: new Date() } },
    { upsert: true }
  );
  return { status: 'waiting' };
}

/** Premium filters arrive from the client; keep only the known, sane keys. */
function sanitizeFilters(f = {}) {
  const out = {};
  const ageMin = Number(f.ageMin);
  const ageMax = Number(f.ageMax);
  if (Number.isFinite(ageMin) && ageMin >= 18 && ageMin <= 99) out.ageMin = ageMin;
  if (Number.isFinite(ageMax) && ageMax >= 18 && ageMax <= 99) out.ageMax = ageMax;
  if (typeof f.countryCode === 'string' && /^[A-Z]{2}$/.test(f.countryCode)) out.countryCode = f.countryCode;
  if (typeof f.language === 'string' && ['en', 'zh', 'ko', 'ja'].includes(f.language)) out.language = f.language;
  return out;
}

/**
 * End a user's current session. Notifies the partner via WS 'match:ended'.
 * @param {'left'|'next'|'disconnect'} reason
 */
function endSession(userId, reason = 'left') {
  const sessionId = userToSession.get(userId);
  if (!sessionId) return null;
  const s = sessions.get(sessionId);
  userToSession.delete(userId);
  if (!s) return null;
  const partnerId = s.users.find((u) => u !== userId);
  sessions.delete(sessionId);
  if (partnerId) {
    userToSession.delete(partnerId);
    emitToUser(partnerId, 'match:ended', { sessionId, reason });
  }
  return { sessionId, partnerId };
}

/** Leave matchmaking entirely (queue + any session). */
async function leave(userId) {
  await MatchmakingQueue.deleteOne({ userId }).catch(() => {});
  endSession(userId, 'left');
}

/** "Next" — drop the current session and re-enter the queue/matcher. */
async function next(user) {
  endSession(user._id.toString(), 'next');
  return join(user, {});
}

/** Relay an ephemeral message to the session partner. Returns false if the
 *  sender isn't actually in that session. */
function relayMessage(fromUserId, sessionId, body) {
  const s = sessions.get(sessionId);
  if (!s || !s.users.includes(fromUserId)) return false;
  s.lastActivity = Date.now();
  const partnerId = s.users.find((u) => u !== fromUserId);
  emitToUser(partnerId, 'match:message', {
    sessionId,
    fromUserId,
    body: String(body).slice(0, 1000),
    createdAt: new Date().toISOString(),
  });
  return true;
}

/** Cleanup hook for socket disconnect. */
async function onDisconnect(userId) {
  await MatchmakingQueue.deleteOne({ userId }).catch(() => {});
  endSession(userId, 'disconnect');
}

// Reap idle sessions (both clients gone silent) so memory can't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (now - s.lastActivity > SESSION_TTL_MS) {
      for (const u of s.users) {
        userToSession.delete(u);
        emitToUser(u, 'match:ended', { sessionId: id, reason: 'expired' });
      }
      sessions.delete(id);
    }
  }
}, 60_000).unref?.();

module.exports = { join, leave, next, endSession, relayMessage, onDisconnect, partnerOf };
