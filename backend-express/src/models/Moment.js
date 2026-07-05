const mongoose = require('mongoose');

const momentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, default: '', maxlength: 500 },
    images: [{ type: String }], // max 9 URLs
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    commentsCount: { type: Number, default: 0 },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: [Number], // [lng, lat] — optional
    },
    hasLocation: { type: Boolean, default: false },
    // Human-readable place label shown under the post (e.g. "Kuala Lumpur").
    locationLabel: { type: String, default: null },
    // Friends tagged in this post (FB-style). The post also surfaces in each
    // tagged user's "friends" feed. Uncapped (QQQ); each tag must be a follow/
    // follower of the author (validated at the route layer).
    taggedUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    visibility: {
      type: String,
      enum: ['public', 'friends', 'private'],
      default: 'public',
    },
    isActive: { type: Boolean, default: true },
    // Set when the author edits the moment (PATCH /:id). null = never edited.
    editedAt: { type: Date, default: null },
    // Ephemeral "24h story" moments (STORY1). null = permanent. Past expiry is
    // hidden from feeds and swept by the cleanup job.
    expiresAt: { type: Date, default: null },
    // Auto-hide moderation (services/report.js). `reportCount` counts UNIQUE
    // reporters (enforced by ContentReport's unique index); at 3 the moment is
    // `hidden` from public feeds but still visible to its author (审核中 badge)
    // and to admins. Admins can unhide/delete via the moderation dashboard.
    reportCount: { type: Number, default: 0 },
    hidden: { type: Boolean, default: false },
    hiddenReason: { type: String, default: null },
    hiddenAt: { type: Date, default: null },
    // Set true once an admin unhides the content — prevents the auto-hide engine
    // from immediately re-hiding it on the next report (admin decision wins).
    moderationLocked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

momentSchema.index({ user: 1, createdAt: -1 });
momentSchema.index({ createdAt: -1, visibility: 1, isActive: 1 });
// TTL "cron" (STORY1): MongoDB auto-deletes a moment ~60s after expiresAt.
// Docs with expiresAt null/absent (permanent) are ignored by the TTL monitor.
// Note: this purges the DB row only — orphaned B2 images are a follow-up.
momentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Moment', momentSchema);
