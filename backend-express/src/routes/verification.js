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

// ── GET /api/verification/phrases ─────────────────────────────────────────────
// Returns a random spoken phrase for video verification
const VIDEO_PHRASES = [
  '我叫我自己最帅',
  '今天天气真好',
  '加油加油加油',
  '我在认证我的真实身份',
  '这个应用叫GayMeet',
];

router.get('/phrase', auth, (req, res) => {
  const phrase = VIDEO_PHRASES[Math.floor(Math.random() * VIDEO_PHRASES.length)];
  ok(res, { phrase });
});

// ── POST /api/verification/submit-video ───────────────────────────────────────
router.post(
  '/submit-video',
  auth,
  upload.single('video'),
  async (req, res, next) => {
    try {
      if (!req.file) return err(res, 'No video uploaded', 400);

      // Check premium status
      const User = require('../models/User');
      const user = await User.findById(req.user._id).lean();
      if (!user.isPremium) {
        return err(res, '视频认证需要会员权限', 403);
      }

      const { pose } = req.body;
      if (!pose) return err(res, 'pose is required', 400);

      const videoUrl = `/uploads/${req.file.filename}`;

      const record = await Verification.findOneAndUpdate(
        { user: req.user._id },
        {
          user: req.user._id,
          videoUrl,
          selfieUrl: videoUrl, // reuse selfieUrl field for backward compat
          pose,
          verificationType: 'video',
          status: 'pending',
          reviewedAt: null,
          rejectedReason: null,
        },
        { upsert: true, new: true }
      );

      // Auto-approve after 5 seconds for video
      setTimeout(async () => {
        try {
          await Verification.findByIdAndUpdate(record._id, {
            status: 'approved',
            reviewedAt: new Date(),
          });
          await User.findByIdAndUpdate(req.user._id, {
            isVerified: true,
            isVideoVerified: true,
            verifiedAt: new Date(),
          });
        } catch (autoErr) {
          console.error('Video auto-approve error:', autoErr);
        }
      }, 5000);

      ok(res, { status: 'pending', verificationType: 'video' });
    } catch (e) {
      next(e);
    }
  }
);

module.exports = router;
