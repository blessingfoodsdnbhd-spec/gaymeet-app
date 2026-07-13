const mongoose = require('mongoose');

/**
 * Abuse report against a VoteEvent or a VoteEntry (Apple 1.2 — UGC apps must
 * let users report objectionable content). Admins triage these.
 */
const voteReportSchema = new mongoose.Schema(
  {
    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    targetType: { type: String, enum: ['event', 'entry'], required: true },
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'VoteEvent', default: null },
    entryId: { type: mongoose.Schema.Types.ObjectId, ref: 'VoteEntry', default: null },
    reason: { type: String, default: '' },
    handled: { type: Boolean, default: false },
    // Moderator decision (REPORT2 — 4-action triage). null while pending.
    resolutionAction: {
      type: String,
      enum: ['approved', 'content_removed', 'user_banned', 'ip_banned', null],
      default: null,
    },
    handledAt: { type: Date, default: null },
    handledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

voteReportSchema.index({ createdAt: -1 });

module.exports = mongoose.model('VoteReport', voteReportSchema);
