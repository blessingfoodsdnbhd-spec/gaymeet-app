const mongoose = require('mongoose');

/**
 * Persistent email-login OTP store.
 *
 * Replaces an in-memory `Map` that lived in a single process's RAM — on Render
 * that Map was lost across restarts/redeploys/cold-starts and not shared
 * between instances, so a user could receive the emailed code but have
 * verify-otp find nothing (silent login failure). Storing the code in MongoDB
 * makes it durable and shared across every instance.
 *
 * One row per email (upserted on each send-otp). A TTL index on `expiresAt`
 * lets Mongo auto-purge expired codes, and verify-otp also deletes the row on
 * successful use (one-time use).
 */
const otpCodeSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    code: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// TTL: Mongo deletes the document once `expiresAt` passes (no manual cleanup).
otpCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('OtpCode', otpCodeSchema);
