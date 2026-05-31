const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * Tracks issued refresh tokens so sessions can be REVOKED (HIGH-C).
 *
 * We never store the raw token — only its SHA-256 hash. A refresh token is
 * accepted by /refresh only if a matching, non-revoked, non-expired record
 * exists. This makes "log out everywhere" and "kill sessions on password
 * reset / account compromise" possible, which is impossible with stateless
 * JWTs alone.
 *
 * A TTL index on `expiresAt` lets Mongo auto-purge stale rows.
 */
const refreshTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tokenHash: { type: String, required: true, index: true },
    issuedAt: { type: Date, default: Date.now },
    lastUsedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// Auto-expire rows once past expiresAt (Mongo TTL monitor).
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

const DEFAULT_TTL_DAYS = 30;

// ── Statics ──────────────────────────────────────────────────────────────────

/** Record a freshly-issued refresh token for a user. */
refreshTokenSchema.statics.record = function (userId, token, ttlDays) {
  const days = ttlDays || DEFAULT_TTL_DAYS;
  return this.create({
    userId,
    tokenHash: hashToken(token),
    issuedAt: new Date(),
    expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
  });
};

/** True if this exact token has an active (non-revoked, non-expired) record. */
refreshTokenSchema.statics.isActive = async function (token) {
  const doc = await this.findOne({
    tokenHash: hashToken(token),
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  });
  return !!doc;
};

/**
 * True ONLY if a record exists for this token AND it's been revoked or expired.
 * Used by /refresh for a graceful rollout: tokens issued BEFORE this feature
 * have no record (returns false → still accepted, then recorded on rotation),
 * while explicitly-revoked tokens are rejected. Distinguishes "legacy" from
 * "killed" — plain isActive() can't, and would mass-logout everyone on deploy.
 */
refreshTokenSchema.statics.isRevoked = async function (token) {
  const doc = await this.findOne({ tokenHash: hashToken(token) });
  if (!doc) return false; // no record → legacy token, allow
  return !!doc.revokedAt || doc.expiresAt <= new Date();
};

/**
 * Rotate: revoke the presented token's record and record its replacement.
 * Stamps lastUsedAt on the rotation moment.
 */
refreshTokenSchema.statics.rotate = async function (oldToken, userId, newToken, ttlDays) {
  await this.updateOne(
    { tokenHash: hashToken(oldToken) },
    { $set: { revokedAt: new Date(), lastUsedAt: new Date() } }
  );
  return this.record(userId, newToken, ttlDays);
};

/** Revoke ALL active sessions for a user (password reset, logout-all, delete). */
refreshTokenSchema.statics.revokeAllForUser = function (userId) {
  return this.updateMany(
    { userId, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
};

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
