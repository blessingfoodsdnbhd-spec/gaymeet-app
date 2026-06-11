const router = require('express').Router();
const User = require('../models/User');
const PhotoRequest = require('../models/PhotoRequest');
const UserReport = require('../models/UserReport');
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

// ── GET /api/users/me/blocked — list the users I've blocked ──────────────────
// Two-segment path, so it never collides with the single-segment `/:id/...`
// routes. Returns light cards (id + name + avatar) for a management list.
router.get('/me/blocked', auth, async (req, res, next) => {
  try {
    const me = await User.findById(req.user._id)
      .populate({ path: 'blockedUsers', select: 'nickname avatarUrl photos isOfficial isVerified' })
      .lean();
    const blocked = (me?.blockedUsers || [])
      .filter(Boolean)
      .map((u) => ({
        id: String(u._id),
        nickname: u.nickname,
        avatarUrl: u.avatarUrl || (u.photos && u.photos[0]) || null,
        isOfficial: !!u.isOfficial,
        isVerified: !!u.isVerified,
      }));
    ok(res, { blocked });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/users/:id/report ────────────────────────────────────────────────
router.post('/:id/report', auth, async (req, res, next) => {
  try {
    const { reason, context } = req.body;
    // Client sends free-text context as `detail` (api/safety.ts reportUser).
    const note = req.body.note ?? req.body.detail;
    if (!reason || !VALID_REPORT_REASONS.includes(reason)) {
      return err(res, `reason must be one of: ${VALID_REPORT_REASONS.join(', ')}`);
    }
    if (req.params.id === req.user._id.toString()) {
      return err(res, 'Cannot report yourself');
    }

    // Block automatically on report
    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { blockedUsers: req.params.id },
    });

    // Sever any private-photo access between the two parties.
    cascadeRevokePhotoAccess(req.user._id, req.params.id).catch(() => {});

    // Persist for admin triage (Apple 1.2 — moderators must be able to act on
    // reports). Best-effort: a logging failure must not block the user's report.
    UserReport.create({
      reporterId: req.user._id,
      reportedUserId: req.params.id,
      reason,
      note: typeof note === 'string' ? note.slice(0, 500) : '',
      context: typeof context === 'string' ? context.slice(0, 40) : 'profile',
    }).catch(() => {});

    ok(res, {});
  } catch (e) {
    next(e);
  }
});

module.exports = router;
