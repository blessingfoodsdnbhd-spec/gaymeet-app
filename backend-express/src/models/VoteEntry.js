const mongoose = require('mongoose');

/** A single submission to a VoteEvent. One entry per user per event (MVP). */
const voteEntrySchema = new mongoose.Schema(
  {
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'VoteEvent', required: true, index: true },
    submitterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    photoUrl: { type: String, required: true },
    caption: { type: String, default: '', maxlength: 200 },
    voteCount: { type: Number, default: 0 },
    // Multi-round elimination state. 'active' for single-round events throughout;
    // winnerN is set on the final close for the top 3.
    status: {
      type: String,
      enum: ['active', 'eliminated', 'winner1', 'winner2', 'winner3'],
      default: 'active',
    },
    eliminatedAtRoundIndex: { type: Number, default: null },
  },
  { timestamps: true },
);

// One entry per user per event.
voteEntrySchema.index({ eventId: 1, submitterId: 1 }, { unique: true });
// Sorted leaderboard display.
voteEntrySchema.index({ eventId: 1, voteCount: -1 });

module.exports = mongoose.model('VoteEntry', voteEntrySchema);
