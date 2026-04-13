const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    method: {
      type: String,
      enum: ['bank_transfer', 'ewallet', 'manual'],
      required: true,
    },
    accountDetails: { type: String, required: true }, // bank name + account number or ewallet ID
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'rejected'],
      default: 'pending',
    },
    processedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

withdrawalSchema.index({ user: 1 });
withdrawalSchema.index({ status: 1 });

module.exports = mongoose.model('Withdrawal', withdrawalSchema);
