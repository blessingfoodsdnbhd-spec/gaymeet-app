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
  },
  { timestamps: true },
);

voteReportSchema.index({ createdAt: -1 });

module.exports = mongoose.model('VoteReport', voteReportSchema);
