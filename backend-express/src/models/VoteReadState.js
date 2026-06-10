const mongoose = require('mongoose');

/**
 * Per-user read state for a VoteEvent's entry carousel. Lets the Vote-tab feed
 * resume each card at the last-seen entry and surface a "🆕 N new entries" badge
 * (entries created after `lastSeenAt`). One doc per (user, event).
 */
const voteReadStateSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    voteEventId: { type: mongoose.Schema.Types.ObjectId, ref: 'VoteEvent', required: true, index: true },
    lastSeenEntryId: { type: mongoose.Schema.Types.ObjectId, ref: 'VoteEntry', default: null },
    lastSeenIndex: { type: Number, default: 0 },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

voteReadStateSchema.index({ userId: 1, voteEventId: 1 }, { unique: true });

module.exports = mongoose.model('VoteReadState', voteReadStateSchema);
