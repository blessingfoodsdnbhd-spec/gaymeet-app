const mongoose = require('mongoose');

/** A single submission to a VoteEvent. One entry per user per event (MVP). */
const voteEntrySchema = new mongoose.Schema(
  {
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'VoteEvent', required: true, index: true },
    submitterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    photoUrl: { type: String, required: true },
    caption: { type: String, default: '', maxlength: 200 },
    voteCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// One entry per user per event.
voteEntrySchema.index({ eventId: 1, submitterId: 1 }, { unique: true });
// Sorted leaderboard display.
voteEntrySchema.index({ eventId: 1, voteCount: -1 });

module.exports = mongoose.model('VoteEntry', voteEntrySchema);
