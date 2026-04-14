/**
 * Two-Factor Authentication routes (TOTP, RFC 6238)
 * Uses Node's built-in crypto — no external TOTP library needed.
 *
 * POST /api/2fa/setup    → generate secret + QR URI, save as pending
 * POST /api/2fa/verify   → confirm OTP and activate 2FA
 * POST /api/2fa/disable  → disable 2FA (requires current OTP)
 * GET  /api/2fa/status   → return { isEnabled, pendingSetup }
 */

const router = require('express').Router();
const crypto = require('crypto');
const { auth } = require('../middleware/auth');
const TwoFactorAuth = require('../models/TwoFactorAuth');
const { ok, err } = require('../utils/respond');

// ── TOTP helpers (RFC 6238 / RFC 4226) ───────────────────────────────────────

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function generateBase32Secret(bytes = 20) {
  const buf = crypto.randomBytes(bytes);
  let result = '';
  let bits = 0;
  let value = 0;
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      result += BASE32_CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) result += BASE32_CHARS[(value << (5 - bits)) & 31];
  return result;
}

function base32Decode(encoded) {
  const upper = encoded.toUpperCase().replace(/=+$/, '');
  let bits = 0;
  let value = 0;
  const output = [];
  for (const char of upper) {
    const idx = BASE32_CHARS.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

function hotp(secret, counter) {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  // Write 64-bit big-endian counter
  const hi = Math.floor(counter / 0x100000000);
  const lo = counter >>> 0;
  buf.writeUInt32BE(hi, 0);
  buf.writeUInt32BE(lo, 4);
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[19] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 1000000).padStart(6, '0');
}

function verifyTotp(secret, token, windowSize = 1) {
  const now = Math.floor(Date.now() / 1000);
  const counter = Math.floor(now / 30);
  for (let i = -windowSize; i <= windowSize; i++) {
    if (hotp(secret, counter + i) === String(token).trim()) return true;
  }
  return false;
}

function generateBackupCodes(count = 8) {
  return Array.from({ length: count }, () =>
    crypto.randomBytes(5).toString('hex').toUpperCase()
  );
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/2fa/status
router.get('/status', auth, async (req, res, next) => {
  try {
    const doc = await TwoFactorAuth.findOne({ user: req.user._id });
    ok(res, {
      isEnabled: doc?.isEnabled ?? false,
      pendingSetup: doc?.pendingSetup ?? false,
    });
  } catch (e) {
    next(e);
  }
});

// POST /api/2fa/setup — generate a new secret and return QR URI
router.post('/setup', auth, async (req, res, next) => {
  try {
    const existing = await TwoFactorAuth.findOne({ user: req.user._id });
    if (existing?.isEnabled) {
      return err(res, '2FA is already enabled. Disable it first.');
    }

    const secret = generateBase32Secret();
    const label = encodeURIComponent(req.user.email);
    const issuer = encodeURIComponent('GayMeet');
    const otpauthUri = `otpauth://totp/${issuer}:${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;

    await TwoFactorAuth.findOneAndUpdate(
      { user: req.user._id },
      { user: req.user._id, secret, isEnabled: false, pendingSetup: true, backupCodes: [] },
      { upsert: true, new: true }
    );

    ok(res, { secret, otpauthUri });
  } catch (e) {
    next(e);
  }
});

// POST /api/2fa/verify — confirm OTP to activate
router.post('/verify', auth, async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) return err(res, 'token is required');

    const doc = await TwoFactorAuth.findOne({ user: req.user._id }).select('+secret +backupCodes');
    if (!doc) return err(res, 'Run /setup first', 404);

    if (!verifyTotp(doc.secret, token)) {
      return err(res, 'Invalid or expired OTP', 401);
    }

    const backupCodes = generateBackupCodes();
    doc.isEnabled = true;
    doc.pendingSetup = false;
    doc.backupCodes = backupCodes;
    await doc.save();

    ok(res, { success: true, backupCodes });
  } catch (e) {
    next(e);
  }
});

// POST /api/2fa/disable
router.post('/disable', auth, async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) return err(res, 'token is required');

    const doc = await TwoFactorAuth.findOne({ user: req.user._id }).select('+secret +backupCodes');
    if (!doc?.isEnabled) return err(res, '2FA is not enabled');

    // Accept either a TOTP token or a backup code
    const isValidTotp = verifyTotp(doc.secret, token);
    const backupIdx = doc.backupCodes.indexOf(String(token).toUpperCase().trim());
    const isValidBackup = backupIdx !== -1;

    if (!isValidTotp && !isValidBackup) {
      return err(res, 'Invalid OTP or backup code', 401);
    }

    if (isValidBackup) {
      doc.backupCodes.splice(backupIdx, 1); // consume backup code
    }

    doc.isEnabled = false;
    doc.pendingSetup = false;
    await doc.save();

    ok(res, { success: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
