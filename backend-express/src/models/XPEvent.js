const mongoose = require('mongoose');

/**
 * Append-only XP ledger — powers the daily/weekly leaderboards (sum amount in a
 * window) and the per-day message cap (count today's 'message' events). Rows
 * self-expire after 90 days via the TTL index, so no archive cron is needed.
 */
const xpEventSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    roomId: { type: String, default: null },
    amount: { type: Number, required: true },
    reason: { type: String, enum: ['message', 'daily', 'channel_join', 'bonus'], required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

// Leaderboard windows: by user, newest first.
xpEventSchema.index({ userId: 1, createdAt: -1 });
// TTL — also serves the daily/weekly time-window aggregation across all users.
xpEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('XPEvent', xpEventSchema);
