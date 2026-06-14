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
    // Single-round (default) or staged elimination (淘汰赛). For multiRound the
    // `rounds` array defines each stage upfront; `currentRoundIndex` advances as
    // closeEndedEvents() processes round deadlines. `startAt`/`endAt` mirror the
    // first round's start and the last round's end so existing queries still work.
    type: { type: String, enum: ['single', 'multiRound'], default: 'single' },
    rounds: [
      {
        index: { type: Number },
        startAt: { type: Date },
        endAt: { type: Date },
        // How many entries are ELIMINATED at this round's end:
        //   'percent' → bottom advanceValue% of still-active entries
        //   'fixed'   → bottom advanceValue entries
        advanceMode: { type: String, enum: ['percent', 'fixed'], default: 'percent' },
        advanceValue: { type: Number, default: 50 },
        _id: false,
      },
    ],
    currentRoundIndex: { type: Number, default: 0 },
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
    // Auto-moderation (anti-spam Phase 1): hidden from everyone but the creator
    // and admins once N distinct users report it.
    hidden: { type: Boolean, default: false },
    autoHiddenAt: { type: Date, default: null },
    autoHiddenReason: { type: String, default: null },
    moderationStatus: {
      type: String,
      enum: ['none', 'auto_hidden', 'confirmed', 'restored'],
      default: 'none',
    },
  },
  { timestamps: true },
);

voteEventSchema.index({ status: 1, startAt: -1 });
voteEventSchema.index({ creatorId: 1, createdAt: -1 });
voteEventSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('VoteEvent', voteEventSchema);
