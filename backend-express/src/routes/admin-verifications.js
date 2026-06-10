// Admin photo/video verification review (VERIFY1). Lists pending real-person
// verification submissions and lets an admin approve or reject them. Approval
// flips the user's isVerified (+ isVideoVerified for video) → green badge.
// Gated by requireAdminAuth (X-Admin-Token OR a Bearer JWT in ADMIN_EMAILS).
const router = require('express').Router();
const { requireAdminAuth } = require('../middleware/adminAuth');
const { ok, err } = require('../utils/respond');
const Verification = require('../models/Verification');
const User = require('../models/User');

router.use(requireAdminAuth);

// ── GET /api/admin/verifications — pending submissions, newest first ──────────
router.get('/verifications', async (req, res, next) => {
  try {
    const status = req.query.status || 'pending';
    const records = await Verification.find({ status })
      .populate('user', 'nickname avatarUrl')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    const verifications = records.map((r) => ({
      id: String(r._id),
      userId: r.user ? String(r.user._id) : null,
      nickname: r.user?.nickname || '—',
      avatarUrl: r.user?.avatarUrl || null,
      pose: r.pose,
      verificationType: r.verificationType || 'photo',
      selfieUrl: r.selfieUrl || null,
      videoUrl: r.videoUrl || null,
      status: r.status,
      createdAt: r.createdAt,
    }));

    ok(res, { verifications, count: verifications.length });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/admin/verifications/:id/approve ────────────────────────────────
router.post('/verifications/:id/approve', async (req, res, next) => {
  try {
    const record = await Verification.findById(req.params.id);
    if (!record) return err(res, 'Verification not found', 404);

    record.status = 'approved';
    record.reviewedAt = new Date();
    record.rejectedReason = null;
    await record.save();

    await User.findByIdAndUpdate(record.user, {
      isVerified: true,
      isVideoVerified: record.verificationType === 'video',
      verifiedAt: new Date(),
    });

    ok(res, { success: true });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/admin/verifications/:id/reject ─────────────────────────────────
router.post('/verifications/:id/reject', async (req, res, next) => {
  try {
    const record = await Verification.findById(req.params.id);
    if (!record) return err(res, 'Verification not found', 404);

    record.status = 'rejected';
    record.reviewedAt = new Date();
    record.rejectedReason = (req.body?.reason || '').slice(0, 200) || null;
    await record.save();

    // Strip any verified flag that an earlier approval may have granted.
    await User.findByIdAndUpdate(record.user, {
      isVerified: false,
      isVideoVerified: false,
      verifiedAt: null,
    });

    ok(res, { success: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
