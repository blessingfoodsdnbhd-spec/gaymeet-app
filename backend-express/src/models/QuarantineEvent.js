const mongoose = require('mongoose');

/**
 * A pending/resolved quarantine, raised when an IP crosses 5 vote-creations in a
 * day. Instead of auto-banning, we suspend posting for every account on the IP,
 * hide their votes, and record this event for an admin to Ban or Approve.
 */
const quarantineSchema = new mongoose.Schema(
  {
    ip: { type: String, required: true, index: true },
    affectedUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    affectedVoteIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'VoteEvent' }],
    triggeredAt: { type: Date, default: Date.now, index: true },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolution: { type: String, enum: ['banned', 'approved', null], default: null },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.QuarantineEvent ||
  mongoose.model('QuarantineEvent', quarantineSchema, 'quarantineevents');
