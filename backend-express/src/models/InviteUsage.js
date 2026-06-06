const mongoose = require('mongoose');

/**
 * A single redemption of an invite code. `inviteeId` is unique — a user can
 * redeem an invite exactly once, ever (the hard anti-fraud guard). Both parties
 * get a Premium reward, recorded here for auditing.
 */
const inviteUsageSchema = new mongoose.Schema(
  {
    inviterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    inviteeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    inviterRewardMs: { type: Number, default: 30 * 24 * 60 * 60 * 1000 },
    inviteeRewardMs: { type: Number, default: 30 * 24 * 60 * 60 * 1000 },
    redeemedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// One redemption per (inviter, invitee) pair (inviteeId already unique overall).
inviteUsageSchema.index({ inviterId: 1, inviteeId: 1 }, { unique: true });

module.exports = mongoose.model('InviteUsage', inviteUsageSchema);
