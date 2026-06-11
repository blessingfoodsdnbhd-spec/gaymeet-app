const mongoose = require('mongoose');

// Random-chat matchmaking queue (Plaza Phase 3). A user has at most one row
// here while they're waiting for a partner. The actual 1-on-1 sessions are
// ephemeral and live in-memory (services/matchmakingService.js) — only the
// *waiting* state is persisted, so a server restart doesn't strand users in a
// dead queue (the TTL reaps stale rows).
const matchmakingQueueSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    // Premium-only narrowing. Free users always join with an empty filter (any).
    // (No gender filter — this app has no gender field on User.)
    filters: {
      ageMin: { type: Number, default: null },
      ageMax: { type: Number, default: null },
      countryCode: { type: String, default: null },
      language: { type: String, default: null },
    },
    // Snapshot of the joiner's own matchable attributes, so the matcher can
    // evaluate the *other* side's filters without a second DB read.
    attrs: {
      age: { type: Number, default: null },
      countryCode: { type: String, default: null },
      language: { type: String, default: null },
    },
    joinedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

// Reap abandoned queue entries after 5 min (a live client re-joins/polls well
// within this; a crashed/closed client gets cleaned up automatically).
matchmakingQueueSchema.index({ joinedAt: 1 }, { expireAfterSeconds: 300 });

module.exports = mongoose.model('MatchmakingQueue', matchmakingQueueSchema);
