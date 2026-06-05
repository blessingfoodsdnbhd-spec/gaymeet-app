const mongoose = require('mongoose');

/**
 * 投票活動 / Voting contest — a community photo/talent/food/etc. contest.
 * Reframes Meyou as a creator-community app (Apple 4.3(b)). `status` is
 * denormalized for fast querying and advanced by closeEndedEvents() on a
 * 60s interval; responses also compute an effective status on read so a
 * just-elapsed event reads correctly between sweeps.
 */
const voteEventSchema = new mongoose.Schema(
  {
    creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, maxlength: 80 },
    description: { type: String, default: '', maxlength: 500 },
    category: {
      type: String,
      enum: ['photography', 'outfit', 'food', 'travel', 'talent', 'pets'],
      required: true,
    },
    coverPhotos: { type: [String], default: [] }, // ≤5 (enforced in route)
    referencePhotos: { type: [String], default: [] }, // ≤5, optional
    externalLink: { type: String, default: null },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    rules: {
      mode: { type: String, enum: ['one', 'fivePerDay', 'unlimited'], default: 'one' },
    },
    status: { type: String, enum: ['pending', 'active', 'ended'], default: 'pending', index: true },
    entryCount: { type: Number, default: 0 },
    voteCount: { type: Number, default: 0 },
    topEntries: [
      {
        entryId: { type: mongoose.Schema.Types.ObjectId, ref: 'VoteEntry' },
        rank: { type: Number },
        _id: false,
      },
    ],
    // Denormalized from the creator at creation time so the "nearby" scope can
    // $near without a join. [lng, lat].
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] },
    },
  },
  { timestamps: true },
);

voteEventSchema.index({ status: 1, startAt: -1 });
voteEventSchema.index({ creatorId: 1, createdAt: -1 });
voteEventSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('VoteEvent', voteEventSchema);
