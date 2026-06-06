const router = require('express').Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const Match = require('../models/Match');
const GiftTransaction = require('../models/GiftTransaction');
const Energy = require('../models/Energy');
const Follow = require('../models/Follow');
const Notification = require('../models/Notification');
const NotificationPreference = require('../models/NotificationPreference');
const { ALL_TYPES } = require('../services/notificationService');
const { auth } = require('../middleware/auth');
const { ok, err } = require('../utils/respond');

// ── POST /api/notifications/token ─────────────────────────────────────────────
router.post('/token', auth, async (req, res, next) => {
  try {
    const { token } = req.body;
    if (token) {
      await User.findByIdAndUpdate(req.user._id, { fcmToken: token });
    }
    ok(res, { success: true });
  } catch (e) {
    next(e);
  }
});

// ── DELETE /api/notifications/token ──────────────────────────────────────────
router.delete('/token', auth, async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { fcmToken: null });
    ok(res, { success: true });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/notifications/schedule ─────────────────────────────────────────
router.post('/schedule', auth, async (req, res, next) => {
  try {
    ok(res, { queued: true });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/notifications ────────────────────────────────────────────────────
// Aggregated recent activity for the current user.
// Returns up to 50 items sorted newest-first, typed for client rendering.
router.get('/', auth, async (req, res, next) => {
  try {
    const uid = req.user._id;
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // last 30 days

    const [matches, gifts, energies, follows] = await Promise.all([
      // New matches
      Match.find({ users: uid, isActive: true, createdAt: { $gte: since } })
        .sort({ createdAt: -1 })
        .limit(20)
        .populate({ path: 'users', select: 'nickname avatarUrl', match: { _id: { $ne: uid } } })
        .lean(),

      // Gifts received
      GiftTransaction.find({ receiver: uid, createdAt: { $gte: since } })
        .sort({ createdAt: -1 })
        .limit(20)
        .populate('sender', 'nickname avatarUrl')
        .populate('gift', 'name iconUrl')
        .lean(),

      // Energy received
      Energy.find({ receiver: uid, createdAt: { $gte: since } })
        .sort({ createdAt: -1 })
        .limit(20)
        .populate('sender', 'nickname avatarUrl')
        .lean(),

      // New followers
      Follow.find({ following: uid, createdAt: { $gte: since } })
        .sort({ createdAt: -1 })
        .limit(20)
        .populate('follower', 'nickname avatarUrl')
        .lean(),
    ]);

    const notifications = [
      ...matches.map((m) => ({
        type: 'match',
        id: m._id,
        user: m.users?.find((u) => u),
        createdAt: m.createdAt,
      })),
      ...gifts.map((g) => ({
        type: 'gift',
        id: g._id,
        user: g.sender,
        gift: g.gift,
        createdAt: g.createdAt,
      })),
      ...energies.map((e) => ({
        type: 'energy',
        id: e._id,
        user: e.sender,
        amount: e.amount,
        createdAt: e.createdAt,
      })),
      ...follows.map((f) => ({
        type: 'follow',
        id: f._id,
        user: f.follower,
        createdAt: f.createdAt,
      })),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 50);

    ok(res, notifications);
  } catch (e) {
    next(e);
  }
});

// ── Persisted Notification Center ─────────────────────────────────────────────

const DEFAULT_PREFS = { disabled: [], quietStartHour: null, quietEndHour: null };

// GET /api/notifications/preferences
router.get('/preferences', auth, async (req, res, next) => {
  try {
    const pref = await NotificationPreference.findOne({ userId: req.user._id }).lean();
    ok(res, {
      disabled: pref?.disabled ?? DEFAULT_PREFS.disabled,
      quietStartHour: pref?.quietStartHour ?? null,
      quietEndHour: pref?.quietEndHour ?? null,
      allTypes: ALL_TYPES,
    });
  } catch (e) {
    next(e);
  }
});

// PATCH /api/notifications/preferences  { disabled?, quietStartHour?, quietEndHour? }
router.patch('/preferences', auth, async (req, res, next) => {
  try {
    const b = req.body || {};
    const set = {};
    if (Array.isArray(b.disabled)) set.disabled = b.disabled.filter((x) => ALL_TYPES.includes(x));
    const validHour = (h) => h === null || (Number.isInteger(h) && h >= 0 && h <= 23);
    if (b.quietStartHour !== undefined) {
      if (!validHour(b.quietStartHour)) return err(res, 'quietStartHour must be 0–23 or null');
      set.quietStartHour = b.quietStartHour;
    }
    if (b.quietEndHour !== undefined) {
      if (!validHour(b.quietEndHour)) return err(res, 'quietEndHour must be 0–23 or null');
      set.quietEndHour = b.quietEndHour;
    }
    const pref = await NotificationPreference.findOneAndUpdate(
      { userId: req.user._id },
      { $set: set },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();
    ok(res, {
      disabled: pref.disabled ?? [],
      quietStartHour: pref.quietStartHour ?? null,
      quietEndHour: pref.quietEndHour ?? null,
    });
  } catch (e) {
    next(e);
  }
});

// GET /api/notifications/list?before=<id>&limit=30 — persisted records, newest first.
router.get('/list', auth, async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), 50);
    const q = { userId: req.user._id };
    if (req.query.before && mongoose.isValidObjectId(req.query.before)) {
      q._id = { $lt: new mongoose.Types.ObjectId(req.query.before) };
    }
    const rows = await Notification.find(q).sort({ _id: -1 }).limit(limit).lean();
    ok(res, {
      notifications: rows.map((n) => ({
        id: n._id.toString(),
        type: n.type,
        title: n.title,
        body: n.body,
        data: n.data || {},
        read: !!n.read,
        createdAt: n.createdAt,
      })),
    });
  } catch (e) {
    next(e);
  }
});

// GET /api/notifications/unread-count
router.get('/unread-count', auth, async (req, res, next) => {
  try {
    const count = await Notification.countDocuments({ userId: req.user._id, read: false });
    ok(res, { count });
  } catch (e) {
    next(e);
  }
});

// POST /api/notifications/read-all
router.post('/read-all', auth, async (req, res, next) => {
  try {
    await Notification.updateMany({ userId: req.user._id, read: false }, { $set: { read: true } });
    ok(res, { ok: true });
  } catch (e) {
    next(e);
  }
});

// POST /api/notifications/:id/read
router.post('/:id/read', auth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return err(res, 'Invalid id');
    await Notification.updateOne({ _id: req.params.id, userId: req.user._id }, { $set: { read: true } });
    ok(res, { ok: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
