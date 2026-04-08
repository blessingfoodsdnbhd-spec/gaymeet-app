const router = require('express').Router();
const LicensePlate = require('../models/LicensePlate');
const PlateMessage = require('../models/PlateMessage');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { ok, created, err } = require('../utils/respond');
const { hasProfanity } = require('../utils/profanityFilter');

const FREE_DAILY_MSG_LIMIT = 3;

function normalise(plate) {
  return plate.replace(/\s+/g, '').toUpperCase();
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// ── POST /api/plates/claim ────────────────────────────────────────────────────
router.post('/claim', auth, async (req, res, next) => {
  try {
    const { plateNumber, carImageUrl } = req.body;
    if (!plateNumber) return err(res, 'plateNumber required');

    const norm = normalise(plateNumber);

    const existing = await LicensePlate.findOne({ plateNumber: norm });
    if (existing && existing.owner.toString() !== req.user._id.toString()) {
      return err(res, 'Plate already claimed by another user', 409);
    }

    const plate = await LicensePlate.findOneAndUpdate(
      { plateNumber: norm },
      {
        owner: req.user._id,
        carImageUrl: carImageUrl ?? null,
        isActive: true,
      },
      { upsert: true, new: true }
    );

    created(res, { plateNumber: plate.plateNumber, carImageUrl: plate.carImageUrl });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/plates/check/:plate ──────────────────────────────────────────────
router.get('/check/:plate', auth, async (req, res, next) => {
  try {
    const norm = normalise(req.params.plate);
    const plate = await LicensePlate.findOne({ plateNumber: norm, isActive: true });
    const msgCount = await PlateMessage.countDocuments({ plateNumber: norm });

    ok(res, {
      exists: !!plate,
      isClaimed: !!plate,
      messageCount: msgCount,
    });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/plates/message ──────────────────────────────────────────────────
router.post('/message', auth, async (req, res, next) => {
  try {
    const { plateNumber, content } = req.body;
    if (!plateNumber || !content) return err(res, 'plateNumber and content required');
    if (content.length > 200) return err(res, 'Message too long (max 200 chars)');

    const norm = normalise(plateNumber);

    // Profanity gate
    if (hasProfanity(content)) {
      return err(res, 'Message contains inappropriate content', 422);
    }

    const plate = await LicensePlate.findOne({ plateNumber: norm, isActive: true });
    if (!plate) return err(res, 'Plate not found or unclaimed', 404);

    // Cannot message your own plate
    if (plate.owner.toString() === req.user._id.toString()) {
      return err(res, 'Cannot message your own plate', 400);
    }

    const me = req.user;

    // ── Daily limit for free users ─────────────────────────────────────────
    if (!me.isPremium) {
      const today = todayStr();
      const startOfDay = new Date(today + 'T00:00:00.000Z');
      const sentToday = await PlateMessage.countDocuments({
        sender: me._id,
        createdAt: { $gte: startOfDay },
      });

      if (sentToday >= FREE_DAILY_MSG_LIMIT) {
        return res.status(429).json({
          error: 'Daily message limit reached',
          limitReached: true,
          limit: FREE_DAILY_MSG_LIMIT,
          remaining: 0,
        });
      }
    }

    const msg = await PlateMessage.create({
      plateNumber: norm,
      sender: req.user._id,
      content,
    });

    created(res, {
      id: msg._id,
      plateNumber: msg.plateNumber,
      content: msg.content,
      createdAt: msg.createdAt,
    });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/plates/messages  (inbox — shows messages on MY plate) ────────────
router.get('/messages', auth, async (req, res, next) => {
  try {
    const plate = await LicensePlate.findOne({
      owner: req.user._id,
      isActive: true,
    });

    if (!plate) {
      return ok(res, { plateNumber: null, carImageUrl: null, messages: [] });
    }

    const messages = await PlateMessage.find({
      plateNumber: plate.plateNumber,
      senderBlocked: false,
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const me = req.user;

    const formatted = messages.map((m) => {
      const content = me.isPremium || m.isRead ? m.content : m.content.slice(0, 20);
      return {
        id: m._id,
        plateNumber: m.plateNumber,
        content,
        isRead: m.isRead,
        isTruncated: !me.isPremium && !m.isRead && m.content.length > 20,
        createdAt: m.createdAt,
      };
    });

    ok(res, {
      plateNumber: plate.plateNumber,
      carImageUrl: plate.carImageUrl,
      messages: formatted,
    });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/plates/messages/:id/report ──────────────────────────────────────
router.post('/messages/:id/report', auth, async (req, res, next) => {
  try {
    const { reason } = req.body;

    const plate = await LicensePlate.findOne({ owner: req.user._id });
    if (!plate) return err(res, 'No plate claimed', 404);

    const msg = await PlateMessage.findOne({
      _id: req.params.id,
      plateNumber: plate.plateNumber,
    });
    if (!msg) return err(res, 'Message not found', 404);

    msg.isReported = true;
    msg.reportReason = reason ?? 'other';
    await msg.save();

    ok(res, { success: true });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/plates/messages/:id/block ───────────────────────────────────────
router.post('/messages/:id/block', auth, async (req, res, next) => {
  try {
    const plate = await LicensePlate.findOne({ owner: req.user._id });
    if (!plate) return err(res, 'No plate claimed', 404);

    const msg = await PlateMessage.findOne({
      _id: req.params.id,
      plateNumber: plate.plateNumber,
    });
    if (!msg) return err(res, 'Message not found', 404);

    // Block all messages from this sender on this plate
    await PlateMessage.updateMany(
      { plateNumber: plate.plateNumber, sender: msg.sender },
      { senderBlocked: true }
    );

    // Also block the user account-wide
    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { blockedUsers: msg.sender },
    });

    ok(res, { success: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
