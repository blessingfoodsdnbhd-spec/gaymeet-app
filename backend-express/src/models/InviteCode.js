const mongoose = require('mongoose');

/**
 * One invite code per user for the mutual-Premium referral system (distinct
 * from the legacy coin-based `User.referralCode`). `usedCount` is denormalized
 * for the "已邀请 N 个朋友" stat.
 */
const inviteCodeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    code: { type: String, required: true, unique: true, uppercase: true },
    usedCount: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

module.exports = mongoose.model('InviteCode', inviteCodeSchema);
