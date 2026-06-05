const mongoose = require('mongoose');

/**
 * A permanent "高光时刻 / Highlight" badge earned by placing top-3 in a
 * VoteEvent. All display fields are denormalized so the badge survives the
 * event's (and entry's) later deletion.
 */
const userHighlightSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'VoteEvent', default: null },
    eventTitle: { type: String, default: '' },
    entryPhotoUrl: { type: String, default: '' },
    rank: { type: Number, min: 1, max: 3, required: true },
    endedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

userHighlightSchema.index({ userId: 1, endedAt: -1 });
// One highlight per user per event (close logic upserts).
userHighlightSchema.index({ userId: 1, eventId: 1 }, { unique: true });

module.exports = mongoose.model('UserHighlight', userHighlightSchema);
