const mongoose = require('mongoose');

const giftSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    icon: { type: String, required: true }, // emoji or URL
    price: { type: Number, required: true }, // in coins
    category: {
      type: String,
      enum: ['romantic', 'fun', 'luxury'],
      required: true,
    },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

giftSchema.index({ category: 1, sortOrder: 1 });

module.exports = mongoose.model('Gift', giftSchema);
