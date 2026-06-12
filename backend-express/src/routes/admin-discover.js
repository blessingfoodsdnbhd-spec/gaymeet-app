// Admin Discover/Nearby tools. Lets an admin reset swipe history so passed /
// skipped users reappear in the swipe deck — either globally (every user) or
// scoped to a single user (customer support). Only `direction: 'pass'` rows are
// removed; `like` / `super_like` swipes are preserved so existing Likes and
// Matches are never broken. Every reset is recorded to AdminAction.
//
// Auth: requireAdminAuth — X-Admin-Token header OR a Bearer JWT whose account
// is official / in ADMIN_EMAILS. See middleware/adminAuth.js.
const router = require('express').Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const Swipe = require('../models/Swipe');
const { requireAdminAuth } = require('../middleware/adminAuth');
const { logAdminAction } = require('../services/adminAudit');
const { ok, err } = require('../utils/respond');

router.use(requireAdminAuth);

const isId = (v) => mongoose.Types.ObjectId.isValid(v);

// The swipe directions that represent a "skip / passed" decision. Likes and
// super-likes are intentionally excluded so matches stay intact.
const PASS_DIRECTIONS = ['pass'];

// ── POST /api/admin/discover/reset-all ────────────────────────────────────────
// Wipe every user's passed/skipped swipes. After this, everyone can swipe
// through everyone they previously skipped again. Likes/super-likes (and thus
// Matches) are untouched. Irreversible — the client gates this behind a confirm.
router.post('/discover/reset-all', async (req, res, next) => {
  try {
    const result = await Swipe.deleteMany({ direction: { $in: PASS_DIRECTIONS } });
    const removed = result.deletedCount || 0;

    await logAdminAction(req.user, 'discover_reset_all', {
      targetType: 'swipe',
      meta: { removed, scope: 'all', directions: PASS_DIRECTIONS },
    });

    ok(res, { removed, scope: 'all' });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/admin/discover/reset-user/:userId ───────────────────────────────
// Wipe a single user's passed/skipped swipes so they re-see everyone they
// skipped. Their Likes/Matches are preserved.
router.post('/discover/reset-user/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!isId(userId)) return err(res, 'Invalid user id');

    const user = await User.findById(userId).select('_id nickname').lean();
    if (!user) return err(res, 'User not found', 404);

    const result = await Swipe.deleteMany({
      fromUser: user._id,
      direction: { $in: PASS_DIRECTIONS },
    });
    const removed = result.deletedCount || 0;

    await logAdminAction(req.user, 'discover_reset_user', {
      targetUser: user._id,
      targetType: 'swipe',
      targetId: user._id,
      meta: { removed, scope: 'user', directions: PASS_DIRECTIONS },
    });

    ok(res, { removed, scope: 'user', userId: String(user._id) });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
