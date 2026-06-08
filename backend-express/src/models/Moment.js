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
    // tagged user's "friends" feed. Capped at 10 at the route layer.
    taggedUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    visibility: {
      type: String,
      enum: ['public', 'friends', 'private'],
      default: 'public',
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

momentSchema.index({ user: 1, createdAt: -1 });
momentSchema.index({ createdAt: -1, visibility: 1, isActive: 1 });

module.exports = mongoose.model('Moment', momentSchema);
