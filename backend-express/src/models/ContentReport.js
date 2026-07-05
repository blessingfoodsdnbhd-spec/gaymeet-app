const mongoose = require('mongoose');

/**
 * A unique abuse report filed against a piece of UGC content (a moment/post, a
 * vote event, or a vote entry). Unlike the per-surface report collections
 * (UserReport / VoteReport / WorldChatReport — kept for the admin triage queue),
 * this collection exists to power AUTO-HIDE: once N *distinct* users report the
 * same target, the target is hidden from public feeds (see services/report.js).
 *
 * The unique index on (reporterId, targetType, targetId) is what makes the
 * "3 UNIQUE users" rule bulletproof — a single user hammering report can only
 * ever create one row per target, so `reportCount` can never be inflated by one
 * person. A duplicate insert throws E11000, which the service treats as a silent
 * no-op (idempotent report).
 */
const contentReportSchema = new mongoose.Schema(
  {
    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // 'moment' → Moment · 'voteEvent' → VoteEvent · 'voteEntry' → VoteEntry.
    targetType: { type: String, enum: ['moment', 'voteEvent', 'voteEntry'], required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    reason: { type: String, default: '' },
    // True if the reporter is an admin (isOfficial / ADMIN_EMAILS). An admin
    // report carries weight 3 → hides the target immediately (see services/report.js).
    byAdmin: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// One report per (user, target) — enforces the unique-reporter count.
contentReportSchema.index({ reporterId: 1, targetType: 1, targetId: 1 }, { unique: true });
// Admin triage / lookups by target.
contentReportSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

module.exports = mongoose.model('ContentReport', contentReportSchema);
