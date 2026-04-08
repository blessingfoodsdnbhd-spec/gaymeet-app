const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { ok, err } = require('../utils/respond');
const SecretCode = require('../models/SecretCode');
const Match = require('../models/Match');

// ── POST /api/codes/set ───────────────────────────────────────────────────────
router.post('/set', auth, async (req, res, next) => {
  try {
    const raw = req.body.code;
    if (!raw) return err(res, 'code is required', 400);

    const code = raw.toString().toLowerCase().trim();
    if (code.length < 2 || code.length > 30) {
      return err(res, 'Code must be 2-30 characters', 400);
    }

    // Deactivate any existing active code for this user
    await SecretCode.updateMany(
      { user: req.user._id, isActive: true },
      { isActive: false }
    );

    // Check if another active code with same text exists (from a different user)
    const existing = await SecretCode.findOne({
      code,
      isActive: true,
      user: { $ne: req.user._id },
    }).populate('user', 'nickname avatarUrl isVerified isPremium');

    if (existing) {
      // Match found!
      const now = new Date();

      // Deactivate both codes
      await SecretCode.updateMany(
        { _id: existing._id },
        { isActive: false, matchedWith: req.user._id, matchedAt: now }
      );

      // Save this user's code as matched too
      await SecretCode.create({
        user: req.user._id,
        code,
        isActive: false,
        matchedWith: existing.user._id,
        matchedAt: now,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      // Create a Match between the two users (if not already matched)
      const existingMatch = await Match.findOne({
        users: { $all: [req.user._id, existing.user._id] },
      });

      let matchId = existingMatch?._id;
      if (!existingMatch) {
        const newMatch = await Match.create({
          users: [req.user._id, existing.user._id],
        });
        matchId = newMatch._id;
      }

      return ok(res, {
        matched: true,
        matchId: matchId?.toString(),
        matchedUser: {
          id: existing.user._id,
          nickname: existing.user.nickname,
          avatarUrl: existing.user.avatarUrl,
          isVerified: existing.user.isVerified,
          isPremium: existing.user.isPremium,
        },
      });
    }

    // No match — save as active
    const newCode = await SecretCode.create({
      user: req.user._id,
      code,
      isActive: true,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    ok(res, {
      matched: false,
      codeId: newCode._id,
      code: newCode.code,
      expiresAt: newCode.expiresAt,
      message: '等待匹配中...',
    });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/codes/active ─────────────────────────────────────────────────────
router.get('/active', auth, async (req, res, next) => {
  try {
    const code = await SecretCode.findOne({
      user: req.user._id,
      isActive: true,
      expiresAt: { $gt: new Date() },
    }).lean();

    ok(res, code ?? null);
  } catch (e) {
    next(e);
  }
});

// ── DELETE /api/codes/active ──────────────────────────────────────────────────
router.delete('/active', auth, async (req, res, next) => {
  try {
    await SecretCode.updateMany(
      { user: req.user._id, isActive: true },
      { isActive: false }
    );
    ok(res, { cancelled: true });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/codes/history ────────────────────────────────────────────────────
router.get('/history', auth, async (req, res, next) => {
  try {
    const history = await SecretCode.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('matchedWith', 'nickname avatarUrl')
      .lean();
    ok(res, history);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
