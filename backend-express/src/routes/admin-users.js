// Admin user tools. Auth: requireAdminAuth — X-Admin-Token header OR an
// ADMIN_EMAILS JWT. See middleware/adminAuth.js.
const router = require('express').Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const { requireAdminAuth } = require('../middleware/adminAuth');
const { ok, err } = require('../utils/respond');

// ── POST /api/admin/users/:id/popularity ─────────────────────────────────────
// Body: { delta: number } — bumps the user's totalLikesReceived (the like
// component of popularity) by delta. Clamped to >= 0. Used to seed/boost
// popular users manually.
router.post('/users/:id/popularity', requireAdminAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return err(res, 'Invalid user id');
    const delta = Number(req.body?.delta);
    if (!Number.isFinite(delta) || Number.isNaN(delta)) {
      return err(res, 'delta must be a number');
    }

    // Atomic, clamped at 0 — a negative delta can't drive the counter below zero.
    const updated = await User.findByIdAndUpdate(
      id,
      [
        {
          $set: {
            totalLikesReceived: {
              $max: [0, { $add: [{ $ifNull: ['$totalLikesReceived', 0] }, delta] }],
            },
          },
        },
      ],
      { new: true },
    ).select('nickname totalLikesReceived followersCount');
    if (!updated) return err(res, 'User not found', 404);

    ok(res, {
      id,
      nickname: updated.nickname,
      totalLikesReceived: updated.totalLikesReceived,
      followersCount: updated.followersCount,
      popularity: (updated.totalLikesReceived || 0) + (updated.followersCount || 0),
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
