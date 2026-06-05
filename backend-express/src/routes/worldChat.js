const router = require('express').Router();
const mongoose = require('mongoose');
const WorldChatMessage = require('../models/WorldChatMessage');
const WorldChatBan = require('../models/WorldChatBan');
const WorldChatReport = require('../models/WorldChatReport');
const { auth } = require('../middleware/auth');
const { requireAdminAuth } = require('../middleware/adminAuth');
const { ok, created, err } = require('../utils/respond');

const BODY_MAX = 500;
const RATE_MS = 3000; // 1 message / 3s / user

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

function broadcast(event, payload) {
  try {
    require('../services/socketService').getIO().emit(event, payload);
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

    const banned = await WorldChatBan.exists({ userId: req.user._id });
    if (banned) return err(res, 'You are banned from World Chat', 403);

    if (BLOCKLIST.test(body)) return err(res, 'Message blocked by content filter', 422);

    const uid = req.user._id.toString();
    const now = Date.now();
    const prev = lastSent.get(uid) || 0;
    if (now - prev < RATE_MS) {
      return res.status(429).json({ error: 'Slow down', code: 'RATE_LIMIT' });
    }
    lastSent.set(uid, now);

    const msg = await WorldChatMessage.create({ userId: req.user._id, body });

    const payload = {
      messageId: msg._id.toString(),
      userId: uid,
      displayName: req.user.nickname,
      avatarUrl: req.user.avatarUrl ?? null,
      body: msg.body,
      createdAt: msg.createdAt.toISOString(),
    };
    broadcast('world-chat:receive', payload);
    created(res, payload);
  } catch (e) {
    next(e);
  }
});

// ── GET /api/world-chat/recent?before=<msgId>&limit=50 ────────────────────────
router.get('/recent', auth, async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
    const before = req.query.before;

    const bannedIds = await WorldChatBan.find().distinct('userId');
    const blocked = (req.user.blockedUsers || []).map((id) => id.toString());
    const excludeSet = new Set([...bannedIds.map((id) => id.toString()), ...blocked]);
    const excludeIds = [...excludeSet].map((id) => new mongoose.Types.ObjectId(id));

    const q = { userId: { $nin: excludeIds } };
    if (before && mongoose.isValidObjectId(before)) {
      q._id = { $lt: new mongoose.Types.ObjectId(before) };
    }

    const rows = await WorldChatMessage.find(q)
      .sort({ _id: -1 })
      .limit(limit)
      .populate('userId', 'nickname avatarUrl')
      .lean();

    const messages = rows
      .filter((m) => m.userId) // populate -> null if the user was deleted
      .map((m) => ({
        messageId: m._id.toString(),
        userId: m.userId._id.toString(),
        displayName: m.userId.nickname,
        avatarUrl: m.userId.avatarUrl ?? null,
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
