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
