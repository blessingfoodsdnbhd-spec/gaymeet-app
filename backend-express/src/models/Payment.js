const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['premium', 'coins', 'boost', 'event'],
      required: true,
    },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'MYR' },
    referralProcessed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

paymentSchema.index({ user: 1 });
paymentSchema.index({ referralProcessed: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
