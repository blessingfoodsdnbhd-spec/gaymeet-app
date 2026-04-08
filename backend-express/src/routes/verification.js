const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { ok, err } = require('../utils/respond');
const Verification = require('../models/Verification');
const User = require('../models/User');

const POSES = [
  '请用右手比V✌️',
  '请用左手摸右耳',
  '请竖起大拇指👍',
  '请用手指指向鼻子',
  '请做OK手势👌',
];

// ── GET /api/verification/pose ─────────────────────────────────────────────────
// Returns a random pose challenge
router.get('/pose', auth, (req, res) => {
  const pose = POSES[Math.floor(Math.random() * POSES.length)];
  ok(res, { pose });
});

// ── GET /api/verification/status ──────────────────────────────────────────────
router.get('/status', auth, async (req, res, next) => {
  try {
    const record = await Verification.findOne({ user: req.user._id }).lean();
    if (!record) return ok(res, { status: 'none' });
    ok(res, { status: record.status, pose: record.pose, createdAt: record.createdAt });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/verification/submit ─────────────────────────────────────────────
router.post('/submit', auth, upload.single('selfie'), async (req, res, next) => {
  try {
    if (!req.file) return err(res, 'No selfie uploaded', 400);

    const { pose } = req.body;
    if (!pose) return err(res, 'pose is required', 400);

    const selfieUrl = `/uploads/${req.file.filename}`;

    // Upsert verification record
    const record = await Verification.findOneAndUpdate(
      { user: req.user._id },
      {
        user: req.user._id,
        selfieUrl,
        pose,
        status: 'pending',
        reviewedAt: null,
        rejectedReason: null,
      },
      { upsert: true, new: true }
    );

    // Auto-approve after 3 seconds (MVP simulation)
    setTimeout(async () => {
      try {
        await Verification.findByIdAndUpdate(record._id, {
          status: 'approved',
          reviewedAt: new Date(),
        });
        await User.findByIdAndUpdate(req.user._id, {
          isVerified: true,
          verifiedAt: new Date(),
        });
      } catch (autoErr) {
        console.error('Auto-approve error:', autoErr);
      }
    }, 3000);

    ok(res, { status: 'pending', pose: record.pose });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
