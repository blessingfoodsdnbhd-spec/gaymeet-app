const mongoose = require('mongoose');

// A gifted Premium grant (item 8). One row per gift; drives rate-limiting
// (per-sender daily cap + per-recipient cooldown) and the recipient's history.
const premiumGiftSchema = new mongoose.Schema(
  {
    gifter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    days: { type: Number, default: 7 },
  },
  { timestamps: true }
);

premiumGiftSchema.index({ gifter: 1, createdAt: -1 });
premiumGiftSchema.index({ gifter: 1, recipient: 1, createdAt: -1 });

module.exports = mongoose.model('PremiumGift', premiumGiftSchema);
