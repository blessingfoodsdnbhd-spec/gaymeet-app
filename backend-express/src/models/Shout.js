const mongoose = require('mongoose');

const shoutSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true, maxlength: 140 },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: [Number], // [lng, lat]
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h TTL
    },
  },
  { timestamps: true }
);

shoutSchema.index({ location: '2dsphere' });
shoutSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

module.exports = mongoose.model('Shout', shoutSchema);
