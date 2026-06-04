const mongoose = require('mongoose');

/**
 * "Who viewed your profile" (谁在看你). One row per viewer→viewed pair (unique
 * index); viewedAt is bumped on each subsequent view, so the list is effectively
 * de-duplicated to the most recent view per viewer. Rows self-expire 30 days
 * after the last view via the TTL index on viewedAt.
 */
const profileViewSchema = new mongoose.Schema(
  {
    viewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    viewedId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    viewedAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

// One row per pair → upsert-friendly de-dup.
profileViewSchema.index({ viewerId: 1, viewedId: 1 }, { unique: true });
// Newest-first listing for a given viewed user.
profileViewSchema.index({ viewedId: 1, viewedAt: -1 });
// Auto-expire 30 days after the last view.
profileViewSchema.index({ viewedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('ProfileView', profileViewSchema);
