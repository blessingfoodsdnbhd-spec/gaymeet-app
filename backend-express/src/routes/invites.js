const router = require('express').Router();
const User = require('../models/User');
const InviteUsage = require('../models/InviteUsage');
const { auth } = require('../middleware/auth');
const { ok, err } = require('../utils/respond');
const { getOrCreateCode, redeemInvite } = require('../services/inviteService');

const SITE = process.env.PUBLIC_SITE_URL || 'https://meyou.uk';

// GET /api/invites/me/code — the caller's invite code (auto-generated once).
router.get('/me/code', auth, async (req, res, next) => {
  try {
    const doc = await getOrCreateCode(req.user._id);
    ok(res, {
      code: doc.code,
      usedCount: doc.usedCount,
      link: `${SITE}/invite/${doc.code}`,
    });
  } catch (e) {
    next(e);
  }
});

// GET /api/invites/me/stats — count + recent invitees.
router.get('/me/stats', auth, async (req, res, next) => {
  try {
    const doc = await getOrCreateCode(req.user._id);
    const recent = await InviteUsage.find({ inviterId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('inviteeId', 'nickname avatarUrl')
      .lean();
    ok(res, {
      invitedCount: doc.usedCount,
      recentInvitees: recent
        .filter((r) => r.inviteeId)
        .map((r) => ({
          id: r.inviteeId._id.toString(),
          displayName: r.inviteeId.nickname,
          avatarUrl: r.inviteeId.avatarUrl ?? null,
          redeemedAt: r.redeemedAt,
        })),
    });
  } catch (e) {
    next(e);
  }
});

// POST /api/invites/redeem { code } — redeem someone else's invite code.
router.post('/redeem', auth, async (req, res, next) => {
  try {
    const result = await redeemInvite(req.user._id, req.body?.code);
    if (result.error) return res.status(400).json({ error: result.error, code: result.error });
    const user = await User.findById(req.user._id);
    ok(res, { success: true, user: user.toPublicJSON() });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
