const router = require('express').Router();
const User = require('../models/User');
const Referral = require('../models/Referral');
const { signAccess, signRefresh, verifyRefresh } = require('../utils/jwt');
const { auth } = require('../middleware/auth');
const { ok, created, err } = require('../utils/respond');
const generateUniqueReferralCode = require('../utils/generateReferralCode');

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, nickname, referralCode, deviceFingerprint } = req.body;
    if (!email || !password || !nickname) {
      return err(res, 'email, password and nickname are required');
    }
    if (password.length < 6) return err(res, 'Password must be at least 6 characters');

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return err(res, 'Email already registered', 409);

    // Auto-generate a unique referral code for this new user
    const myReferralCode = await generateUniqueReferralCode();

    // Resolve referrer if a code was provided
    let referredBy = null;
    let referrerDoc = null;
    if (referralCode) {
      referrerDoc = await User.findOne({ referralCode: referralCode.toUpperCase() }).select('_id deviceFingerprint');
      if (referrerDoc) {
        // Fraud: same device fingerprint
        if (deviceFingerprint && referrerDoc.deviceFingerprint === deviceFingerprint) {
          referredBy = null; // silently ignore — don't block registration
        } else {
          referredBy = referrerDoc._id;
        }
      }
    }

    const user = await User.create({
      email,
      password,
      nickname,
      referralCode: myReferralCode,
      referredBy,
      deviceFingerprint: deviceFingerprint || null,
    });

    // Create pending referral relationship
    if (referredBy) {
      await Referral.create({
        referrer: referredBy,
        referred: user._id,
        referralCode: referralCode.toUpperCase(),
        status: 'pending',
      }).catch(() => {}); // ignore duplicate errors
      await User.findByIdAndUpdate(referredBy, { $inc: { referralCount: 1 } });
    }

    const accessToken = signAccess(user._id.toString());
    const refreshToken = signRefresh(user._id.toString());

    created(res, {
      accessToken,
      refreshToken,
      user: user.toPublicJSON(),
    });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return err(res, 'email and password are required');

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) return err(res, 'Invalid credentials', 401);

    const valid = await user.comparePassword(password);
    if (!valid) return err(res, 'Invalid credentials', 401);

    // Update online status
    user.isOnline = true;
    user.lastActiveAt = new Date();
    await user.save();

    const accessToken = signAccess(user._id.toString());
    const refreshToken = signRefresh(user._id.toString());

    ok(res, { accessToken, refreshToken, user: user.toPublicJSON() });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/auth/refresh ────────────────────────────────────────────────────
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return err(res, 'refreshToken required');

    let payload;
    try {
      payload = verifyRefresh(refreshToken);
    } catch {
      return err(res, 'Invalid or expired refresh token', 401);
    }

    const user = await User.findById(payload.sub);
    if (!user) return err(res, 'User not found', 401);

    const accessToken = signAccess(user._id.toString());
    const newRefreshToken = signRefresh(user._id.toString());

    ok(res, { accessToken, refreshToken: newRefreshToken });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
router.post('/logout', auth, async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { isOnline: false });
    ok(res, { success: true });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/auth/me (Flutter calls GET /users/me — handled in users.js) ──────
// Alias here for convenience
router.get('/me', auth, (req, res) => {
  ok(res, req.user.toPublicJSON());
});

module.exports = router;
