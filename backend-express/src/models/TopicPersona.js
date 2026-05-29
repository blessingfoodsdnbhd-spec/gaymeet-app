const mongoose = require('mongoose');

/**
 * Per-user, per-topic identity. The Discover topic-tab UI renders these
 * rows — viewers see ONLY the persona's nickname + photos for the topic
 * they're browsing, and don't learn which other topics the same user
 * has joined (or what their main-profile name is) until they go through
 * the TopicUnlock approval flow.
 *
 *   userId      – owner; ref User
 *   topicSlug   – matches Topic.slug; we denormalize the slug instead of
 *                 the Topic._id because most queries are slug-keyed and
 *                 it lets us drop the join for the common list path
 *   nickname    – display name shown ONLY inside this topic; capped at
 *                 30 to align with the main-profile nickname cap
 *   photos      – B2 URLs uploaded via /api/upload (same pipeline as
 *                 main-profile photos); cap enforced at route level
 *                 (Free 3, Premium 5)
 *   isActive    – soft-leave; DELETE flips false rather than removing
 *                 so unlock recipients still see the row history
 *
 * Compound indexes:
 *   { userId, topicSlug } unique — at most one persona per (user, topic)
 *   { topicSlug, isActive, updatedAt: -1 } — the topic-tab list scan
 *   { userId, isActive } — "my personas" list for ProfileScreen
 */
const topicPersonaSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    topicSlug: { type: String, required: true, trim: true },
    nickname: {
      type: String,
      required: true,
      trim: true,
      maxlength: 30,
    },
    photos: {
      type: [String],
      default: [],
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

topicPersonaSchema.index({ userId: 1, topicSlug: 1 }, { unique: true });
topicPersonaSchema.index({ topicSlug: 1, isActive: 1, updatedAt: -1 });
topicPersonaSchema.index({ userId: 1, isActive: 1 });

module.exports = mongoose.model('TopicPersona', topicPersonaSchema);
