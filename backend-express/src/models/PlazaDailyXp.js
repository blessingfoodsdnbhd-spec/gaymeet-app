const mongoose = require('mongoose');

// Per-user, per-day activity points ("XP earned today") powering the Plaza
// daily leaderboard. One row per (userId, day) — incremented when a user is
// active in Plaza (e.g. sends a message). Day is a UTC 'YYYY-MM-DD' string so
// "today" is a cheap exact-match query and rows are naturally archived by day.
//
// Forward-compatible with the richer Phase 2 XP system: when that lands it can
// award into the same row. Until then, Plaza message activity is the only
// source, so the board still works standalone.
const plazaDailyXpSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    day: { type: String, required: true }, // 'YYYY-MM-DD' (UTC)
    xp: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

plazaDailyXpSchema.index({ userId: 1, day: 1 }, { unique: true });
// Leaderboard query: top xp within a day.
plazaDailyXpSchema.index({ day: 1, xp: -1 });
// Keep ~30 days of history, then let the daily rows expire.
plazaDailyXpSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

/** UTC day key for a given Date (defaults to now). */
plazaDailyXpSchema.statics.dayKey = function (d = new Date()) {
  return new Date(d).toISOString().slice(0, 10);
};

/** Award XP to a user for today (fire-and-forget upsert). */
plazaDailyXpSchema.statics.award = function (userId, xp) {
  const day = this.dayKey();
  return this.updateOne(
    { userId, day },
    { $inc: { xp }, $set: { updatedAt: new Date() } },
    { upsert: true }
  ).catch(() => {});
};

module.exports = mongoose.model('PlazaDailyXp', plazaDailyXpSchema);
