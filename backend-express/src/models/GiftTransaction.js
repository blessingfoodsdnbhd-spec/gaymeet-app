const mongoose = require('mongoose');

const giftTransactionSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    gift: { type: mongoose.Schema.Types.ObjectId, ref: 'Gift', required: true },
    message: { type: String, default: null, maxlength: 100 },
    coins: { type: Number, required: true }, // price at time of transaction
    isFreeGift: { type: Boolean, default: false },
  },
  { timestamps: true }
);

giftTransactionSchema.index({ receiver: 1, createdAt: -1 });
giftTransactionSchema.index({ sender: 1, createdAt: -1 });

module.exports = mongoose.model('GiftTransaction', giftTransactionSchema);
