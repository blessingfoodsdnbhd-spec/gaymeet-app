const mongoose = require('mongoose');

const promotionSchema = new mongoose.Schema(
  {
    imageUrl: { type: String, default: '' },
    title: { type: String, required: true },
    subtitle: { type: String, required: true },
    actionUrl: { type: String, default: null },
    type: {
      type: String,
      enum: ['banner', 'interstitial', 'both'],
      default: 'both',
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    priority: { type: Number, default: 0 }, // higher = shown first
  },
  { timestamps: true }
);

promotionSchema.index({ startDate: 1, endDate: 1, isActive: 1 });

module.exports = mongoose.model('Promotion', promotionSchema);
