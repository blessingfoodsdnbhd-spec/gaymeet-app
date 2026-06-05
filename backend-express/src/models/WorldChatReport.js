const mongoose = require('mongoose');

/**
 * An abuse report filed against a World Chat message (Apple 1.2 — UGC apps
 * must let users report objectionable content). Admins triage these.
 */
const worldChatReportSchema = new mongoose.Schema(
  {
    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    messageId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorldChatMessage', required: true },
    // Denormalized so a report survives the message's 7-day TTL expiry.
    reportedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    body: { type: String, default: '' },
    reason: { type: String, default: '' },
    handled: { type: Boolean, default: false },
  },
  { timestamps: true },
);

worldChatReportSchema.index({ createdAt: -1 });

module.exports = mongoose.model('WorldChatReport', worldChatReportSchema);
