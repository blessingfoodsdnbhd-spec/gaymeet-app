const router = require('express').Router();
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { ok, err } = require('../utils/respond');

const VALID_REPORT_REASONS = [
  'inappropriate_photos',
  'harassment',
  'spam',
  'fake_profile',
  'underage',
  'other',
];

// ── POST /api/users/:id/block ─────────────────────────────────────────────────
router.post('/:id/block', auth, async (req, res, next) => {
  try {
    const targetId = req.params.id;
    if (targetId === req.user._id.toString()) {
      return err(res, 'Cannot block yourself');
    }

    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { blockedUsers: targetId },
    });

    ok(res, {});
  } catch (e) {
    next(e);
  }
});

// ── POST /api/users/:id/report ────────────────────────────────────────────────
router.post('/:id/report', auth, async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason || !VALID_REPORT_REASONS.includes(reason)) {
      return err(res, `reason must be one of: ${VALID_REPORT_REASONS.join(', ')}`);
    }

    // Block automatically on report
    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { blockedUsers: req.params.id },
    });

    // In production: log to a reports collection
    // For now, just acknowledge
    ok(res, {});
  } catch (e) {
    next(e);
  }
});

module.exports = router;
