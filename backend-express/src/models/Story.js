const mongoose = require('mongoose');

const storySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    mediaUrl: { type: String, required: true },
    mediaType: {
      type: String,
      enum: ['image', 'video'],
      default: 'image',
    },
    caption: { type: String, default: '', maxlength: 100 },
    viewedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    viewCount: { type: Number, default: 0 },
    // Hard expiry stored as a Date; MongoDB TTL index removes the doc automatically
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// Auto-delete when expiresAt passes (TTL = 0 means delete at the indexed time)
storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
storySchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Story', storySchema);
