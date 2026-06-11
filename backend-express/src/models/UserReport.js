const mongoose = require('mongoose');

/**
 * An abuse report filed against another user / their profile (Apple 1.2 — UGC
 * apps must let users report objectionable content AND give moderators a way to
 * act on those reports within 24h). Reporting a user also auto-blocks them
 * (see routes/blocks.js); persisting the report here gives admins an auditable
 * triage queue surfaced in the admin reports dashboard.
 */
const userReportSchema = new mongoose.Schema(
  {
    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reportedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // One of VALID_REPORT_REASONS in routes/blocks.js
    // (inappropriate_photos | harassment | spam | fake_profile | underage | other).
    reason: { type: String, default: '' },
    // Optional free-text context, and where the report originated (profile,
    // comment, moment, chat …) so moderators see what surface was flagged.
    note: { type: String, default: '' },
    context: { type: String, default: 'profile' },
    handled: { type: Boolean, default: false },
  },
  { timestamps: true },
);

userReportSchema.index({ createdAt: -1 });
userReportSchema.index({ handled: 1, createdAt: -1 });

module.exports = mongoose.model('UserReport', userReportSchema);
