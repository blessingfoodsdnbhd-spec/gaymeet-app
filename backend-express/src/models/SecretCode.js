const mongoose = require('mongoose');

const secretCodeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    code: { type: String, required: true }, // normalized: lowercase, trimmed
    isActive: { type: Boolean, default: true },
    matchedWith: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    matchedAt: { type: Date, default: null },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
    },
  },
  { timestamps: true }
);

// TTL index — auto-expire after expiresAt
secretCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
secretCodeSchema.index({ user: 1, isActive: 1 });
secretCodeSchema.index({ code: 1, isActive: 1 });

module.exports = mongoose.model('SecretCode', secretCodeSchema);
