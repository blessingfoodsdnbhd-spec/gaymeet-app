const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema(
  {
    referrer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    referred: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    referralCode: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'active', 'suspended'],
      default: 'pending',
    },
    totalCommissionEarned: { type: Number, default: 0 },
  },
  { timestamps: true }
);

referralSchema.index({ referrer: 1 });
referralSchema.index({ referred: 1 }, { unique: true }); // one referral per user
referralSchema.index({ referralCode: 1 });

module.exports = mongoose.model('Referral', referralSchema);
