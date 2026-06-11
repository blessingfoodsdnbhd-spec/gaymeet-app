const mongoose = require('mongoose');

/**
 * Plaza random-matchmaking queue (Phase 3). One row per user currently waiting
 * for a ❤️ random chat partner. Rows are short-lived: claimed (deleted) the
 * instant a partner is found, and auto-expired after 5 min as a safety net if a
 * client vanishes mid-search. The live 1-on-1 session itself is ephemeral and
 * lives in-memory (see routes/plaza.js sessionStore) — nothing about a random
 * chat is persisted.
 */
const matchmakingQueueSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true, // a user is only ever in the queue once
      index: true,
    },
    // Snapshot of the seeker's own attributes so a candidate can test their
    // filters against us without a second User lookup.
    attrs: {
      age: { type: Number, default: null },
      countryCode: { type: String, default: null },
      gender: { type: String, default: null },
      language: { type: String, default: null },
    },
    // Desired partner filters (Premium only; free users send {}).
    filters: {
      ageMin: { type: Number, default: null },
      ageMax: { type: Number, default: null },
      countryCode: { type: String, default: null },
      gender: { type: String, default: null },
      language: { type: String, default: null },
    },
  },
  { timestamps: true }
);

// Safety-net TTL: a stale waiting row self-destructs after 5 min.
matchmakingQueueSchema.index({ createdAt: 1 }, { expireAfterSeconds: 5 * 60 });

module.exports = mongoose.model('MatchmakingQueue', matchmakingQueueSchema);
