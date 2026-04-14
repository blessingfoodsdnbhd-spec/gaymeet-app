const router = require('express').Router();
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { ok, err } = require('../utils/respond');

// Lazy-require models that may not exist in all contexts
let Moment, Match, Message;
try { Moment = require('../models/Moment'); } catch (_) {}
try { Match = require('../models/Match'); } catch (_) {}
try { Message = require('../models/Message'); } catch (_) {}

// ── GET /api/account/export ───────────────────────────────────────────────────
router.get('/export', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).lean();
    delete user.password;

    const exportData = { user };

    if (Moment) {
      try {
        exportData.moments = await Moment.find({ author: req.user._id }).lean();
      } catch (_) {}
    }
    if (Match) {
      try {
        exportData.matches = await Match.find({
          $or: [{ user1: req.user._id }, { user2: req.user._id }],
        }).lean();
      } catch (_) {}
    }
    if (Message) {
      try {
        exportData.messages = await Message.find({ sender: req.user._id })
          .sort({ createdAt: -1 })
          .limit(100)
          .lean();
      } catch (_) {}
    }

    const filename = `gaymeet-data-${req.user._id}-${Date.now()}.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(exportData, null, 2));
  } catch (e) {
    next(e);
  }
});

// ── DELETE /api/account/delete ────────────────────────────────────────────────
router.delete('/delete', auth, async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password) return err(res, 'password is required');

    const user = await User.findById(req.user._id).select('+password');
    if (!user) return err(res, 'User not found', 404);

    const valid = await user.comparePassword(password);
    if (!valid) return err(res, 'Invalid password', 401);

    const now = new Date();
    const deleteScheduledAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    user.isDeleted = true;
    user.deletedAt = now;
    user.deleteScheduledAt = deleteScheduledAt;
    await user.save();

    ok(res, {
      success: true,
      message: 'Account scheduled for deletion in 30 days',
      deleteScheduledAt,
    });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/account/status ───────────────────────────────────────────────────
router.get('/status', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('isDeleted deletedAt deleteScheduledAt').lean();
    if (!user) return err(res, 'User not found', 404);

    ok(res, {
      isDeleted: user.isDeleted || false,
      deletedAt: user.deletedAt || null,
      deleteScheduledAt: user.deleteScheduledAt || null,
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
