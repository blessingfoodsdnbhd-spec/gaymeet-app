const mongoose = require('mongoose');

const stickerSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    emoji: { type: String, required: true }, // the emoji character used as sticker
    imageUrl: { type: String, default: null }, // optional real image URL
  },
  { _id: false }
);

const stickerPackSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: '' },
    coverEmoji: { type: String, required: true }, // cover emoji
    stickers: [stickerSchema],
    price: { type: Number, default: 0 }, // coins; 0 = free
    category: {
      type: String,
      enum: ['free', 'new', 'popular', 'premium'],
      default: 'new',
    },
    totalDownloads: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('StickerPack', stickerPackSchema);
