const mongoose = require('mongoose');

/**
 * Chat-activity XP / level (吹水等级) — DISTINCT from the energy-based
 * User.level (which tracks energy *received*). This counts what a user
 * contributes to the Plaza: messages sent, time online, channels joined.
 * One doc per user, upserted on the first XP award.
 */
const userXPSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    totalXP: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    // Last UTC date (YYYY-MM-DD) the daily online bonus was granted — guards
    // against double-awarding within a day across restarts.
    lastDailyClaim: { type: String, default: null },
    // roomId -> accumulated minutes online in that room (best-effort analytics).
    perRoomTime: { type: Map, of: Number, default: {} },
    // Channels this user has already been awarded the first-join bonus for.
    joinedChannels: { type: [String], default: [] },
  },
  { timestamps: true },
);

// Leaderboard (all-time) — top totalXP first.
userXPSchema.index({ totalXP: -1 });

module.exports = mongoose.model('UserXP', userXPSchema);
