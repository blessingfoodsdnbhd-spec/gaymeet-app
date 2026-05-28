const router = require('express').Router();
const User = require('../models/User');
const PhotoRequest = require('../models/PhotoRequest');
const { auth } = require('../middleware/auth');
const { ok, err } = require('../utils/respond');

/**
 * When user A blocks user B we cascade-revoke any approved photo-viewing
 * grants in both directions, so neither party retains access to the
 * other's private photos. Rows are marked revoked (not deleted) for audit.
 */
async function cascadeRevokePhotoAccess(userAId, userBId) {
  await PhotoRequest.updateMany(
    {
      $or: [
        { owner: userAId, requester: userBId, status: 'approved' },
        { owner: userBId, requester: userAId, status: 'approved' },
      ],
    },
    { $set: { status: 'revoked', respondedAt: new Date() } }
  );
}

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

    // Sever any private-photo access between the two parties.
    cascadeRevokePhotoAccess(req.user._id, targetId).catch(() => {});

    ok(res, {});
  } catch (e) {
    next(e);
  }
});

// ── DELETE /api/users/:id/block — unblock ────────────────────────────────────
router.delete('/:id/block', auth, async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { blockedUsers: req.params.id },
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

    // Sever any private-photo access between the two parties.
    cascadeRevokePhotoAccess(req.user._id, req.params.id).catch(() => {});

    // In production: log to a reports collection
    // For now, just acknowledge
    ok(res, {});
  } catch (e) {
    next(e);
  }
});

module.exports = router;
