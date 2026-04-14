const router = require('express').Router();
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const crypto = require('crypto');
const TwoFactorAuth = require('../models/TwoFactorAuth');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { ok, err } = require('../utils/respond');

// ── POST /api/2fa/setup ───────────────────────────────────────────────────────
router.post('/setup', auth, async (req, res, next) => {
  try {
    const secret = speakeasy.generateSecret({
      name: `GayMeet (${req.user.email})`,
      issuer: 'GayMeet',
      length: 20,
    });

    // Upsert 2FA record (disabled until verified)
    await TwoFactorAuth.findOneAndUpdate(
      { user: req.user._id },
      { secret: secret.base32, isEnabled: false, backupCodes: [] },
      { upsert: true, new: true }
    );

    const qrCode = await qrcode.toDataURL(secret.otpauth_url);

    ok(res, { qrCode, secret: secret.base32 });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/2fa/verify ──────────────────────────────────────────────────────
router.post('/verify', auth, async (req, res, next) => {
  try {
    const { code } = req.body;
    if (!code) return err(res, 'code is required');

    const tfa = await TwoFactorAuth.findOne({ user: req.user._id });
    if (!tfa) return err(res, '2FA not set up', 404);

    const valid = speakeasy.totp.verify({
      secret: tfa.secret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!valid) return err(res, 'Invalid code', 401);

    // Generate 8 backup codes
    const backupCodes = Array.from({ length: 8 }, () => ({
      code: crypto.randomBytes(4).toString('hex'),
      used: false,
    }));

    tfa.isEnabled = true;
    tfa.backupCodes = backupCodes;
    await tfa.save();

    ok(res, { backupCodes: backupCodes.map((b) => b.code) });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/2fa/disable ─────────────────────────────────────────────────────
router.post('/disable', auth, async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password) return err(res, 'password is required');

    const user = await User.findById(req.user._id).select('+password');
    const valid = await user.comparePassword(password);
    if (!valid) return err(res, 'Invalid password', 401);

    await TwoFactorAuth.findOneAndUpdate(
      { user: req.user._id },
      { isEnabled: false }
    );

    ok(res, { success: true });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/2fa/status ───────────────────────────────────────────────────────
router.get('/status', auth, async (req, res, next) => {
  try {
    const tfa = await TwoFactorAuth.findOne({ user: req.user._id });
    ok(res, { isEnabled: tfa ? tfa.isEnabled : false });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
