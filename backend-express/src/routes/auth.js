const router = require('express').Router();
const User = require('../models/User');
const Referral = require('../models/Referral');
const TwoFactorAuth = require('../models/TwoFactorAuth');
const speakeasy = require('speakeasy');
const { OAuth2Client } = require('google-auth-library');
const appleSignin = require('apple-signin-auth');
const { signAccess, signRefresh, verifyRefresh } = require('../utils/jwt');
const { auth } = require('../middleware/auth');
const { ok, created, err } = require('../utils/respond');
const generateUniqueReferralCode = require('../utils/generateReferralCode');
const { supported: supportedCurrencies } = require('../utils/currency');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// In-memory OTP store: normalizedEmail → { code, expiry }
// Fine for single-instance; replace with Redis for multi-instance.
const otpStore = new Map();

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

    const myReferralCode = await generateUniqueReferralCode();

    let referredBy = null;
    let referrerDoc = null;
    if (referralCode) {
      referrerDoc = await User.findOne({ referralCode: referralCode.toUpperCase() }).select('_id deviceFingerprint');
      if (referrerDoc) {
        if (deviceFingerprint && referrerDoc.deviceFingerprint === deviceFingerprint) {
          referredBy = null;
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
      // Default to KL centre so new users appear in nearby immediately
      location: { type: 'Point', coordinates: [101.6869, 3.1390] },
    });

    if (referredBy) {
      await Referral.create({
        referrer: referredBy,
        referred: user._id,
        referralCode: referralCode.toUpperCase(),
        status: 'pending',
      }).catch(() => {});
      await User.findByIdAndUpdate(referredBy, { $inc: { referralCount: 1 } });
    }

    const accessToken = signAccess(user._id.toString());
    const refreshToken = signRefresh(user._id.toString());

    created(res, { accessToken, refreshToken, user: user.toPublicJSON() });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', async (req, res, next) => {
  try {
    const { email, password, deviceId, deviceName, twoFactorCode } = req.body;
    if (!email || !password) return err(res, 'email and password are required');

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) return err(res, '账号不存在', 404);

    const valid = await user.comparePassword(password);
    if (!valid) return err(res, '密码不正确', 401);

    const tfa = await TwoFactorAuth.findOne({ user: user._id });
    if (tfa && tfa.isEnabled) {
      if (!twoFactorCode) {
        return res.status(202).json({ requiresTwoFactor: true });
      }
      const totpValid = speakeasy.totp.verify({
        secret: tfa.secret,
        encoding: 'base32',
        token: twoFactorCode,
        window: 1,
      });
      if (!totpValid) {
        const backupIndex = tfa.backupCodes.findIndex((b) => !b.used && b.code === twoFactorCode);
        if (backupIndex === -1) return err(res, 'Invalid two-factor code', 401);
        tfa.backupCodes[backupIndex].used = true;
        await tfa.save();
      }
    }

    const resolvedDeviceId = deviceId || `device-${Date.now()}`;
    const resolvedDeviceName = deviceName || req.headers['user-agent'] || 'Unknown Device';
    const ip = req.ip || req.connection?.remoteAddress || null;
    const existingIdx = user.devices?.findIndex((d) => d.deviceId === resolvedDeviceId) ?? -1;
    if (existingIdx >= 0) {
      user.devices[existingIdx].lastUsed = new Date();
      user.devices[existingIdx].deviceName = resolvedDeviceName;
      user.devices[existingIdx].ip = ip;
    } else if (user.devices) {
      user.devices.push({ deviceId: resolvedDeviceId, deviceName: resolvedDeviceName, lastUsed: new Date(), ip, refreshToken: null });
      if (user.devices.length > 5) {
        user.devices.sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed));
        user.devices = user.devices.slice(0, 5);
      }
    }

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

// ── POST /api/auth/google ─────────────────────────────────────────────────────
// Body: { idToken: string }
// Verifies Google ID token, finds or creates user, returns JWT.
router.post('/google', async (req, res, next) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return err(res, 'idToken is required');

    if (!process.env.GOOGLE_CLIENT_ID) {
      return err(res, 'Google Sign-In not configured on server', 501);
    }

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch {
      return err(res, 'Google 身份验证失败', 401);
    }

    const { sub: googleId, email, name } = payload;

    // Try find by googleId first, then by email (link accounts)
    let user = await User.findOne({ googleId }).select('+googleId');
    if (!user && email) {
      user = await User.findOne({ email: email.toLowerCase() });
      if (user) {
        await User.findByIdAndUpdate(user._id, { googleId });
      }
    }
    if (!user) {
      const myReferralCode = await generateUniqueReferralCode();
      user = await User.create({
        email: email ? email.toLowerCase() : `google_${googleId}@placeholder.local`,
        googleId,
        nickname: name || (email ? email.split('@')[0] : `用户${Date.now()}`),
        referralCode: myReferralCode,
      });
    }

    const accessToken = signAccess(user._id.toString());
    const refreshToken = signRefresh(user._id.toString());
    ok(res, { accessToken, refreshToken, user: user.toPublicJSON() });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/auth/apple ──────────────────────────────────────────────────────
// Body: { identityToken: string, name?: string }
// Required for App Store. Verifies Apple identity token, finds or creates user.
router.post('/apple', async (req, res, next) => {
  try {
    const { identityToken, name } = req.body;
    if (!identityToken) return err(res, 'identityToken is required');

    let payload;
    try {
      payload = await appleSignin.verifyIdToken(identityToken, {
        audience: process.env.APPLE_BUNDLE_ID || 'com.meetupnearby.app',
        ignoreExpiration: false,
      });
    } catch {
      return err(res, 'Apple 身份验证失败', 401);
    }

    const { sub: appleId, email } = payload;

    let user = await User.findOne({ appleId }).select('+appleId');
    if (!user && email) {
      user = await User.findOne({ email: email.toLowerCase() });
      if (user) {
        await User.findByIdAndUpdate(user._id, { appleId });
      }
    }
    if (!user) {
      const myReferralCode = await generateUniqueReferralCode();
      const nickname = name || (email ? email.split('@')[0] : `用户${Date.now()}`);
      user = await User.create({
        email: email ? email.toLowerCase() : `apple_${appleId}@placeholder.local`,
        appleId,
        nickname,
        referralCode: myReferralCode,
      });
    }

    const accessToken = signAccess(user._id.toString());
    const refreshToken = signRefresh(user._id.toString());
    ok(res, { accessToken, refreshToken, user: user.toPublicJSON() });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/auth/send-otp ───────────────────────────────────────────────────
// Body: { email: string }
// Generates a 6-digit OTP valid for 10 minutes and logs it to console.
// TODO: replace console.log with a real email transport (nodemailer/SES/Resend).
router.post('/send-otp', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) return err(res, '请输入有效的邮箱地址');

    const normalizedEmail = email.toLowerCase().trim();
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiry = Date.now() + 10 * 60 * 1000;

    otpStore.set(normalizedEmail, { code, expiry });

    // TODO: send real email
    console.log(`[OTP] ${normalizedEmail} → ${code} (expires in 10 min)`);

    ok(res, { success: true });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/auth/verify-otp ─────────────────────────────────────────────────
// Body: { email: string, code: string }
// Verifies OTP, finds or creates user, returns JWT.
router.post('/verify-otp', async (req, res, next) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return err(res, 'email and code are required');

    const normalizedEmail = email.toLowerCase().trim();
    const stored = otpStore.get(normalizedEmail);

    if (!stored) return err(res, '验证码无效或已过期', 401);
    if (Date.now() > stored.expiry) {
      otpStore.delete(normalizedEmail);
      return err(res, '验证码已过期，请重新获取', 401);
    }
    if (stored.code !== code.trim()) return err(res, '验证码不正确', 401);

    otpStore.delete(normalizedEmail); // one-time use

    let user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      const myReferralCode = await generateUniqueReferralCode();
      user = await User.create({
        email: normalizedEmail,
        nickname: normalizedEmail.split('@')[0],
        referralCode: myReferralCode,
      });
    }

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

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', auth, (req, res) => {
  ok(res, req.user.toPublicJSON());
});

// ── PATCH /api/auth/currency ──────────────────────────────────────────────────
router.patch('/currency', auth, async (req, res, next) => {
  try {
    const { currency } = req.body;
    if (!currency) return err(res, 'currency is required');
    if (!supportedCurrencies.includes(currency)) {
      return err(res, `Unsupported currency. Use one of: ${supportedCurrencies.join(', ')}`);
    }
    await User.findByIdAndUpdate(req.user._id, { currency });
    ok(res, { success: true, currency });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/auth/devices ─────────────────────────────────────────────────────
router.get('/devices', auth, async (req, res, next) => {
  try {
    ok(res, { devices: req.user.devices || [] });
  } catch (e) {
    next(e);
  }
});

// ── DELETE /api/auth/devices/:deviceId ───────────────────────────────────────
router.delete('/devices/:deviceId', auth, async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { devices: { deviceId } },
    });
    ok(res, { success: true });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/auth/forgot-password ───────────────────────────────────────────
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return err(res, 'email is required');

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return ok(res, { success: true }); // avoid enumeration

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiry = new Date(Date.now() + 10 * 60 * 1000);

    await User.findByIdAndUpdate(user._id, { resetCode: code, resetCodeExpiry: expiry });

    console.log(`[RESET CODE] ${email} → ${code} (expires ${expiry.toISOString()})`);
    ok(res, { success: true });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/auth/reset-password ────────────────────────────────────────────
router.post('/reset-password', async (req, res, next) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) return err(res, 'email, code and newPassword are required');
    if (newPassword.length < 6) return err(res, 'Password must be at least 6 characters');

    const user = await User.findOne({ email: email.toLowerCase().trim() })
      .select('+resetCode +resetCodeExpiry');
    if (!user || !user.resetCode || user.resetCode !== code) return err(res, 'Invalid or expired code');
    if (!user.resetCodeExpiry || user.resetCodeExpiry < new Date()) return err(res, 'Code has expired — request a new one');

    user.password = newPassword;
    user.resetCode = undefined;
    user.resetCodeExpiry = undefined;
    await user.save();

    ok(res, { success: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
