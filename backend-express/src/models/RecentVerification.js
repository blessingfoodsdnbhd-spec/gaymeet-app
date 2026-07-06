const mongoose = require('mongoose');

/**
 * Short-lived record of a successful OTP verification, for idempotency.
 *
 * Problem it fixes: verify-otp deletes the OtpCode row on first success
 * (one-time use). If the client's UI hangs on the loading spinner and the user
 * re-submits the SAME code, the second request finds no OtpCode row and errors
 * with "code isn't right" — even though the code WAS correct moments ago
 * (observed for meyousocialmedia@gmail.com, 2026-07-06).
 *
 * Fix: on a successful verify we stamp (email, code, userId) here. A repeat
 * verify-otp with the same (email, code) within the TTL window re-issues a
 * session instead of failing. A Mongo TTL index auto-purges rows after 180s so
 * this never becomes a lingering credential.
 */
const recentVerificationSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    code: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// TTL: Mongo deletes each row 180s (3 min) after it was created.
recentVerificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 });

module.exports = mongoose.model('RecentVerification', recentVerificationSchema);
