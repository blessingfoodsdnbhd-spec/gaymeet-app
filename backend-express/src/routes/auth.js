const router = require('express').Router();
const User = require('../models/User');
const Referral = require('../models/Referral');
const TwoFactorAuth = require('../models/TwoFactorAuth');
const speakeasy = require('speakeasy');
const { OAuth2Client } = require('google-auth-library');
const appleSignin = require('apple-signin-auth');
const { signAccess, signRefresh, verifyRefresh } = require('../utils/jwt');
const { auth } = require('../middleware/auth');
const { signupLimiter } = require('../middleware/rateLimit');

// Fire-and-forget: record the client IP on the user for anti-spam forensics.
// Never blocks or throws — sign-in must succeed regardless of this write.
function recordUserIp(userId, ip) {
  if (!userId || !ip) return;
  User.updateOne({ _id: userId }, { $set: { lastLoginIp: ip }, $addToSet: { ipAddresses: ip } }).catch(() => {});
  User.updateOne(
    { _id: userId, $or: [{ registrationIp: null }, { registrationIp: { $exists: false } }] },
    { $set: { registrationIp: ip } },
  ).catch(() => {});
}
const { ok, created, err } = require('../utils/respond');
const { validateDob } = require('../utils/ageGate');
const generateUniqueReferralCode = require('../utils/generateReferralCode');
const { supported: supportedCurrencies } = require('../utils/currency');
const { sendEmail } = require('../utils/email');
const RefreshToken = require('../models/RefreshToken');
const OtpCode = require('../models/OtpCode');
const RecentVerification = require('../models/RecentVerification');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * 18+ gate for the signup paths. Validates the client-sent `dob` and, on
 * failure, writes the 400 itself and returns null so the caller can just
 * `if (!v) return;`. The `code` ('UNDERAGE' | 'DOB_REQUIRED' | 'DOB_INVALID')
 * lets the client show a localized string instead of the bilingual fallback.
 *
 * `required` is decided per-path: true when this call creates a brand-new
 * account, false when an existing (legacy) user is merely signing in — those
 * are gated in-app by `isAgeVerified`, not blocked at the door.
 */
function checkDob(res, raw, required) {
  const v = validateDob(raw, { required });
  if (v.error) {
    res.status(400).json({ error: v.error, code: v.code });
    return null;
  }
  return v;
}

/**
 * Backfill a validated adult DOB onto an account that doesn't have one — a
 * legacy user clearing the age gate on sign-in. No-op when the account already
 * has a DOB (never overwrite: a DOB is set once) or when none was supplied.
 * Must be called on EVERY path that returns a session, including the OTP
 * idempotency short-circuit, or a legacy user's DOB is silently dropped.
 */
async function backfillDob(user, date) {
  if (!date || !user || user.dob) return user;
  user.dob = date;
  user.age = User.computeAge(date);
  await user.save();
  return user;
}

// Known Google OAuth client IDs for this project — used as a fallback so
// iOS Sign-In works even when GOOGLE_IOS_CLIENT_ID isn't set on Render.
// Google client IDs are not secrets (they're shipped in the iOS bundle),
// so it's safe to embed them. Values come from app-rn/app.json `extra`.
const GOOGLE_KNOWN_CLIENT_IDS = [
  '208538145733-r5ib29ovl992losq4hvpu4rt6lniv22a.apps.googleusercontent.com', // Web
  '208538145733-ccuidhniu111ssc70ri9kjrdv6095obs.apps.googleusercontent.com', // iOS
];

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, nickname, referralCode, deviceFingerprint, dob } = req.body;
    if (!email || !password || !nickname) {
      return err(res, 'email, password and nickname are required');
    }
    if (password.length < 6) return err(res, 'Password must be at least 6 characters');

    // 18+ gate — this endpoint always creates a NEW account, so a valid adult
    // DOB is mandatory. Checked before the uniqueness query so an underage
    // signup can't probe which emails are taken.
    const v = checkDob(res, dob, true);
    if (!v) return;

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
      dob: v.date,
      age: User.computeAge(v.date), // denormalized for the nearby age filter
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
    await RefreshToken.record(user._id, refreshToken); // HIGH-C: track session

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

    // Permanent ban / soft-deletion — refuse to issue a session (登录拦截).
    if (user.isBanned || user.isDeleted) return err(res, '账号已被停用', 403);
    recordUserIp(user._id, req.clientIp);

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
    await RefreshToken.record(user._id, refreshToken); // HIGH-C: track session

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
    const { idToken, dob } = req.body;
    if (!idToken) return err(res, 'idToken is required');

    // 18+ gate. Apple/Google hand back an identity token with no birthdate and
    // the native sheet runs before we can ask, so a first-time social user is
    // created WITHOUT a DOB and collected by the in-app age gate (the response
    // carries `isNewUser` + `user.isAgeVerified` for that). A `dob` sent by a
    // client that already asked is honoured — and validated.
    const dobCheck = checkDob(res, dob, false);
    if (!dobCheck) return;

    // Accept any of: env-configured ids, plus the known project ids. iOS
    // tokens have `aud` = the iOS client id, web/Android tokens have `aud`
    // = the web client id — both must work.
    const audiences = Array.from(
      new Set(
        [
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_IOS_CLIENT_ID,
          ...GOOGLE_KNOWN_CLIENT_IDS,
        ].filter(Boolean),
      ),
    );

    if (audiences.length === 0) {
      return err(res, 'Google Sign-In not configured on server', 501);
    }

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: audiences,
      });
      payload = ticket.getPayload();
    } catch (e) {
      // Surface the real reason in server logs (audience mismatch, expired,
      // bad signature, …) so a future bug like this is diagnosable from
      // Render logs instead of a generic 401.
      console.warn('[auth/google] verifyIdToken failed:', e?.message, {
        audiences,
        tokenLen: idToken?.length,
      });
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
    const isNewUser = !user;
    if (!user) {
      const myReferralCode = await generateUniqueReferralCode();
      user = await User.create({
        email: email ? email.toLowerCase() : `google_${googleId}@placeholder.local`,
        googleId,
        nickname: name || (email ? email.split('@')[0] : `用户${Date.now()}`),
        dob: dobCheck.date,
        age: User.computeAge(dobCheck.date),
        referralCode: myReferralCode,
      });
    } else {
      await backfillDob(user, dobCheck.date);
    }

    if (user.isBanned || user.isDeleted) return err(res, '账号已被停用', 403); // 登录拦截

    const accessToken = signAccess(user._id.toString());
    const refreshToken = signRefresh(user._id.toString());
    await RefreshToken.record(user._id, refreshToken); // HIGH-C: track session
    ok(res, { accessToken, refreshToken, user: user.toPublicJSON(), isNewUser });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/auth/apple ──────────────────────────────────────────────────────
// Body: { identityToken: string, name?: string }
// Required for App Store. Verifies Apple identity token, finds or creates user.
router.post('/apple', async (req, res, next) => {
  try {
    const { identityToken, name, dob } = req.body;
    if (!identityToken) return err(res, 'identityToken is required');

    // 18+ gate — same policy as /google above: no birthdate in the identity
    // token, so first-time social users are gated in-app via `isAgeVerified`.
    const dobCheck = checkDob(res, dob, false);
    if (!dobCheck) return;

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
    const isNewUser = !user;
    if (!user) {
      const myReferralCode = await generateUniqueReferralCode();
      const nickname = name || (email ? email.split('@')[0] : `用户${Date.now()}`);
      user = await User.create({
        email: email ? email.toLowerCase() : `apple_${appleId}@placeholder.local`,
        appleId,
        nickname,
        dob: dobCheck.date,
        age: User.computeAge(dobCheck.date),
        referralCode: myReferralCode,
      });
    } else {
      await backfillDob(user, dobCheck.date);
    }

    if (user.isBanned || user.isDeleted) return err(res, '账号已被停用', 403); // 登录拦截

    const accessToken = signAccess(user._id.toString());
    const refreshToken = signRefresh(user._id.toString());
    await RefreshToken.record(user._id, refreshToken); // HIGH-C: track session
    ok(res, { accessToken, refreshToken, user: user.toPublicJSON(), isNewUser });
  } catch (e) {
    next(e);
  }
});

// Scoped fixed-code logins for accounts that can't receive email — app-store
// reviewers + the official Meyou bot (a fake-address seed account the owner
// uses to post in the plaza / manage events). email -> code. The primary
// reviewer pair stays env-overridable. Everyone else uses the real OTP.
// TODO: revisit once a real email provider is fully wired.
const BYPASS_LOGINS = {
  [(process.env.REVIEW_LOGIN_EMAIL || 'hafiz@example.com').toLowerCase().trim()]:
    process.env.REVIEW_LOGIN_CODE || '111111',
  'meyou-bot@meyou.uk': '888888',
  // QA Premium test account — for verifying the Premium-gated chat edit-message
  // flow (Android keyboard fly-to-top). Seeded by scripts/seed-qa-premium.js
  // (isPremium=true, onboarded, has editable messages). Fake domain → no email,
  // so it uses this fixed code. Distinct from hafiz, which MUST stay Free (it's
  // the Apple reviewer demo). Keep this entry; the account is reused.
  'qa-premium@meyou.test': '222222',
};

// Issue an access+refresh session for a user and return the standard auth
// payload. Shared by the normal verify-otp success path and its idempotent
// re-submit path so both mint sessions identically (HIGH-C: session tracking).
async function issueSession(res, user) {
  const accessToken = signAccess(user._id.toString());
  const refreshToken = signRefresh(user._id.toString());
  await RefreshToken.record(user._id, refreshToken);
  // hasPassword lets the client decide whether to prompt an OTP-only account to
  // set a password for faster next login — without ever exposing the hash.
  // `user.password` is select:false, so it's only in memory when the caller
  // selected it (password login / a just-set password); otherwise do a tiny
  // existence check.
  const hasPassword =
    user.password != null
      ? true
      : !!(await User.exists({ _id: user._id, password: { $exists: true, $ne: null } }));
  return ok(res, { accessToken, refreshToken, user: user.toPublicJSON(), hasPassword });
}

// ── POST /api/auth/send-otp ───────────────────────────────────────────────────
// Body: { email: string }
// Generates a 6-digit OTP valid for 30 minutes and emails it (rate-limited 30s).
// TODO: replace console.log with a real email transport (nodemailer/SES/Resend).
router.post('/send-otp', signupLimiter, async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) return err(res, '请输入有效的邮箱地址');

    const normalizedEmail = email.toLowerCase().trim();

    // Bypass accounts can't receive email — don't try to send, just succeed.
    // They sign in with their fixed code in verify-otp.
    if (BYPASS_LOGINS[normalizedEmail]) return ok(res, { success: true });

    // Rate limit: at most one code per email per 30s. Each send upserts the
    // same row and OVERWRITES the previous code, so a user who taps "resend"
    // (or bounces back into the screen re-triggering send-otp) would invalidate
    // the code from the email they already opened — the exact confusion behind
    // the 2026-07-06 "received a code but it's wrong" reports. `updatedAt`
    // (not createdAt) is the time of the LAST send: createdAt is frozen at the
    // first-ever send by the upsert, so it can't gate resends.
    const existing = await OtpCode.findOne({ email: normalizedEmail });
    if (existing && existing.updatedAt && Date.now() - existing.updatedAt.getTime() < 30 * 1000) {
      return err(res, '请稍候再试（30秒后可重发）/ Please wait 30s before resending', 429);
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    // 30-minute validity (was 10). A short TTL turned normal email delivery +
    // typing latency into "expired" failures; 30m is the common OTP default.
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    // Persist in MongoDB (durable + shared across instances) — upsert so a
    // re-send overwrites any prior code for this email.
    await OtpCode.findOneAndUpdate(
      { email: normalizedEmail },
      { code, expiresAt },
      { upsert: true, new: true }
    );

    // Deliver via the email abstraction (console in dev, real provider in prod
    // once configured — utils/email.js). Never logs the code in prod; never
    // throws, so it can't break the login flow.
    // Delivered via the email abstraction (real provider once configured).
    // Note: until a provider is wired, normal users can't receive a code — the
    // review account uses the fixed-code bypass in verify-otp instead. The
    // earlier devCode-in-response fallback was removed (it exposed every
    // email's code); the scoped reviewer bypass is the safer stopgap.
    await sendEmail(
      normalizedEmail,
      'Your Meyou login code',
      `Your Meyou verification code is ${code}. It expires in 30 minutes.`
    );

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
    const { email, code, dob } = req.body;
    if (!email || !code) return err(res, 'email and code are required');

    // 18+ gate. This endpoint is BOTH login and signup — the user doesn't
    // declare which, so a DOB can't be demanded up front without breaking every
    // legacy sign-in. Policy: reject an underage/invalid date whenever one is
    // sent, and let accounts that end up with no DOB be blocked in-app by the
    // non-skippable age gate (`isAgeVerified: false`).
    const dobCheck = checkDob(res, dob, false);
    if (!dobCheck) return;

    const normalizedEmail = email.toLowerCase().trim();
    const trimmedCode = code.trim();

    // ── Idempotency ───────────────────────────────────────────────────────────
    // A successful verify DELETES the OtpCode row (one-time use). If the client
    // hangs on its loading spinner and the user re-submits the SAME code, the
    // OtpCode lookup below finds nothing → we'd wrongly report "wrong code"
    // (observed: meyousocialmedia@gmail.com, 2026-07-06 — account was created,
    // proving the code WAS correct, yet a re-submit errored). So first check the
    // short-lived RecentVerification stamp: same (email, code) verified in the
    // last 3 min → just re-issue a session. Never blocks on ban here re-check
    // below via issueSession's caller path.
    const recent = await RecentVerification.findOne({ email: normalizedEmail, code: trimmedCode });
    if (recent) {
      const ru = await User.findById(recent.userId);
      if (ru) {
        if (ru.isBanned) return err(res, '账号已被封禁 / Account banned', 403);
        // Backfill here too — this path returns a session without falling
        // through to the create/backfill block below, so skipping it would
        // silently drop the DOB of a legacy user who just cleared the gate.
        await backfillDob(ru, dobCheck.date);
        return issueSession(res, ru);
      }
      // Stamp exists but user vanished (deleted) — fall through to normal path.
    }

    // ── Fixed-code bypass ─────────────────────────────────────────────────────
    // Reviewers + the Meyou bot can't receive email (no provider wired / fake
    // address), so each accepts a scoped fixed code (see BYPASS_LOGINS above).
    // Everyone else still goes through the real OTP.
    const isReviewBypass =
      !!BYPASS_LOGINS[normalizedEmail] && trimmedCode === BYPASS_LOGINS[normalizedEmail];

    if (!isReviewBypass) {
      const stored = await OtpCode.findOne({ email: normalizedEmail });
      // Distinct, bilingual messages so each failure is actionable instead of a
      // single ambiguous "code is wrong" (root cause of the 2026-07-06 signup
      // drop-off). The shipped RN app still shows its own local string; these
      // land in the resend Alert and future app versions (vc127+).
      if (!stored) {
        // No row: never requested, already consumed (>3 min ago), or TTL-purged.
        return err(res, '请重新申请验证码（可能已过期或已使用过）/ Please request a new code (may have expired or been used)', 401);
      }
      if (Date.now() > stored.expiresAt.getTime()) {
        await OtpCode.deleteOne({ email: normalizedEmail });
        return err(res, '验证码已过期，请重新申请 / Code expired, please request a new one', 401);
      }
      if (stored.code !== trimmedCode) {
        return err(res, '验证码错误，请检查邮件 / Wrong code, please check the email again', 401);
      }
      await OtpCode.deleteOne({ email: normalizedEmail }); // one-time use
    }

    let user = await User.findOne({ email: normalizedEmail });
    const isNewUser = !user;
    if (!user) {
      const myReferralCode = await generateUniqueReferralCode();
      user = await User.create({
        email: normalizedEmail,
        nickname: normalizedEmail.split('@')[0],
        dob: dobCheck.date,
        age: User.computeAge(dobCheck.date),
        referralCode: myReferralCode,
      });
    } else {
      // Legacy account clearing the age gate — backfill and move on.
      await backfillDob(user, dobCheck.date);
    }

    // New users may pass an invite code — redeem it atomically. Best-effort:
    // an invalid/duplicate code must never block sign-in (client shows a toast).
    if (isNewUser && req.body.inviteCode) {
      try {
        const { redeemInvite } = require('../services/inviteService');
        await redeemInvite(user._id, req.body.inviteCode);
        user = (await User.findById(user._id)) || user; // reflect granted Premium
      } catch (_) {
        /* ignore — sign-in proceeds without the reward */
      }
    }

    // Returning banned / soft-deleted users can't sign in even via OTP.
    if (!isNewUser && (user.isBanned || user.isDeleted)) return err(res, '账号已被停用', 403);
    recordUserIp(user._id, req.clientIp);

    // Stamp this success so an immediate re-submit of the same code is idempotent
    // (see block at top). Best-effort — must never block a valid sign-in. Skip
    // for the fixed-code bypass (those codes are reusable by design).
    if (!isReviewBypass) {
      try {
        await RecentVerification.create({ email: normalizedEmail, code: trimmedCode, userId: user._id });
      } catch (_) {
        /* ignore — idempotency is a nicety, not required for this sign-in */
      }
    }

    return issueSession(res, user);
  } catch (e) {
    next(e);
  }
});

// ── POST /api/auth/register-with-password ─────────────────────────────────────
// Body: { email, password, otpCode, inviteCode? }
// Email+password registration, gated by an OTP the user already received via
// /send-otp (proves email ownership). Writes User.password (bcrypt-hashed by the
// userSchema pre-save hook) — the SAME field /login and /reset-password use, NOT
// a second passwordHash. Does NOT touch /verify-otp. An OTP-only user who never
// set a password can call this to add one to their existing account.
router.post('/register-with-password', async (req, res, next) => {
  try {
    const { email, password, otpCode, inviteCode, dob } = req.body;
    if (!email || !password || password.length < 6 || !otpCode) {
      return err(res, '请填写有效邮箱、验证码和至少6位密码 / Enter a valid email, code and 6+ character password', 400);
    }

    // 18+ gate, pass 1: reject an underage/malformed DOB up front, before the
    // OTP is even read — an underage signup should never consume a code or
    // learn anything about the account. A MISSING dob is tolerated here and
    // re-checked below, once we know whether this creates a new account or just
    // adds a password to an existing (possibly legacy) one.
    const dobCheck = checkDob(res, dob, false);
    if (!dobCheck) return;
    const normalizedEmail = email.toLowerCase().trim();
    const trimmedCode = String(otpCode).trim();

    // Verify the OTP against the same store /verify-otp reads (reviewer/bot fixed
    // codes also accepted). We read the row but only consume it once the account
    // write below succeeds, so a failed write doesn't burn the code.
    const isBypass =
      !!BYPASS_LOGINS[normalizedEmail] && trimmedCode === BYPASS_LOGINS[normalizedEmail];
    if (!isBypass) {
      const stored = await OtpCode.findOne({ email: normalizedEmail });
      if (!stored) return err(res, '请重新申请验证码 / Please request a new code', 401);
      if (Date.now() > stored.expiresAt.getTime()) {
        await OtpCode.deleteOne({ email: normalizedEmail });
        return err(res, '验证码已过期，请重新申请 / Code expired, please request a new one', 401);
      }
      if (stored.code !== trimmedCode) return err(res, '验证码错误 / Wrong code', 401);
    }

    let user = await User.findOne({ email: normalizedEmail }).select('+password');
    const isNewUser = !user;
    // Already has a password → tell them to log in instead of silently overwriting it.
    if (user && user.password) {
      return err(res, '此邮箱已注册，请直接登录 / This email is already registered — please log in', 409);
    }

    // 18+ gate, pass 2: a DOB is mandatory unless the account already has one
    // on file. New accounts must always supply it; an existing OTP-only user
    // adding a password keeps whatever DOB they have (or stays null and hits
    // the in-app age gate).
    if (!dobCheck.date && !user?.dob) {
      const v = checkDob(res, dob, true);
      if (!v) return;
    }

    if (!user) {
      const myReferralCode = await generateUniqueReferralCode();
      user = await User.create({
        email: normalizedEmail,
        password, // hashed by the userSchema pre-save hook
        nickname: normalizedEmail.split('@')[0],
        dob: dobCheck.date,
        age: User.computeAge(dobCheck.date),
        referralCode: myReferralCode,
        // Match /register: default to KL centre so new users appear in nearby.
        location: { type: 'Point', coordinates: [101.6869, 3.1390] },
      });
    } else {
      // Existing OTP-only user adding a password to their account for the first time.
      user.password = password;
      // Backfill DOB if they didn't have one and just supplied a valid adult
      // date — one fewer legacy account to gate on next launch.
      if (!user.dob && dobCheck.date) {
        user.dob = dobCheck.date;
        user.age = User.computeAge(dobCheck.date);
      }
      await user.save();
    }

    // Consume the OTP now that the account write succeeded (skip reusable fixed codes).
    if (!isBypass) await OtpCode.deleteOne({ email: normalizedEmail });

    // Brand-new users may redeem an invite (best-effort — never blocks signup).
    if (isNewUser && inviteCode) {
      try {
        const { redeemInvite } = require('../services/inviteService');
        await redeemInvite(user._id, inviteCode);
        user = (await User.findById(user._id)) || user; // reflect granted Premium
      } catch (_) {
        /* ignore — signup proceeds without the reward */
      }
    }

    if (!isNewUser && user.isBanned) return err(res, '账号已被封禁 / Account banned', 403);

    const accessToken = signAccess(user._id.toString());
    const refreshToken = signRefresh(user._id.toString());
    await RefreshToken.record(user._id, refreshToken); // HIGH-C: track session
    // hasPassword is always true here (we just set it) → client won't prompt.
    created(res, { accessToken, refreshToken, user: user.toPublicJSON(), hasPassword: true });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/auth/set-password ───────────────────────────────────────────────
// Authed. Lets a signed-in user set their FIRST password (or change it) — powers
// the "set a password for faster login?" prompt shown to OTP-only accounts after
// sign-in. Writes User.password (bcrypt-hashed by the userSchema pre-save hook);
// never returns the hash.
router.post('/set-password', auth, async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return err(res, '密码至少 6 位 / Password must be at least 6 characters', 400);
    }
    const user = await User.findById(req.user._id).select('+password');
    if (!user) return err(res, 'User not found', 404);
    user.password = password; // hashed by the userSchema pre-save hook
    await user.save();
    ok(res, { success: true, hasPassword: true });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/auth/login-with-password ────────────────────────────────────────
// Body: { email, password }
// Password login for the RN app. Deliberately returns ONE error for both "no
// such account" and "wrong password" to avoid account enumeration (the older
// /login, kept untouched for the Flutter client, returns distinct messages).
// Doesn't track devices — parity with the OTP path.
router.post('/login-with-password', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return err(res, '请输入邮箱和密码 / Enter your email and password', 400);

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
    if (!user || !user.password) return err(res, '邮箱或密码错误 / Incorrect email or password', 401);

    const match = await user.comparePassword(password);
    if (!match) return err(res, '邮箱或密码错误 / Incorrect email or password', 401);

    if (user.isBanned) return err(res, '账号已被封禁 / Account banned', 403);
    if (user.isDeleted) return err(res, '账号已停用 / Account deactivated', 403);

    user.isOnline = true;
    user.lastActiveAt = new Date();
    await user.save();

    return issueSession(res, user);
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
    } catch (e) {
      // Diagnostic for the "logged out after a while" reports — surfaces whether
      // refreshes fail on signature/expiry (e.g. a rotated JWT_REFRESH_SECRET).
      console.warn('[auth/refresh] verify failed:', e?.name, e?.message);
      return err(res, 'Invalid or expired refresh token', 401);
    }

    const user = await User.findById(payload.sub);
    if (!user) return err(res, 'User not found', 401);

    // HIGH-C: reject tokens whose session was revoked (logout-all / password
    // reset / account compromise). Legacy tokens (issued before tracking) have
    // no record and pass, then get recorded on rotation below.
    if (await RefreshToken.isRevoked(refreshToken)) {
      console.warn('[auth/refresh] token revoked for user', String(payload.sub));
      return err(res, 'Session revoked, please sign in again', 401);
    }

    const accessToken = signAccess(user._id.toString());
    const newRefreshToken = signRefresh(user._id.toString());
    await RefreshToken.rotate(refreshToken, user._id, newRefreshToken);

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

    // Deliver via the email abstraction (see utils/email.js). Never logs the
    // code in prod; never throws.
    await sendEmail(
      email,
      'Reset your Meyou password',
      `Your Meyou password reset code is ${code}. It expires in 10 minutes.`
    );
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

    // HIGH-C: a password change kills every existing session.
    await RefreshToken.revokeAllForUser(user._id);

    ok(res, { success: true });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/auth/logout-all — revoke every session for this user ───────────
router.post('/logout-all', auth, async (req, res, next) => {
  try {
    const result = await RefreshToken.revokeAllForUser(req.user._id);
    await User.findByIdAndUpdate(req.user._id, { isOnline: false });
    ok(res, { success: true, revoked: result.modifiedCount });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
