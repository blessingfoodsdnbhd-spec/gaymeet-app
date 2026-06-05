const mongoose = require('mongoose');

/**
 * A status update posted by a VoteEvent's creator during the contest
 * (活动动态) — "round 1 results are in", "deadline extended", etc. Read by any
 * authenticated user; written/deleted only by the creator.
 */
const voteEventUpdateSchema = new mongoose.Schema(
  {
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'VoteEvent', required: true, index: true },
    body: { type: String, required: true, maxlength: 500 },
    photos: { type: [String], default: [] }, // ≤3 (enforced in route)
  },
  { timestamps: true },
);

voteEventUpdateSchema.index({ eventId: 1, createdAt: -1 });

module.exports = mongoose.model('VoteEventUpdate', voteEventUpdateSchema);
