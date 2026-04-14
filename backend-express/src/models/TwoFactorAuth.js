const mongoose = require('mongoose');

const twoFactorAuthSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    secret: {
      type: String,
      required: true,
      select: false, // Never leak the TOTP secret
    },
    isEnabled: {
      type: Boolean,
      default: false,
    },
    // 8 single-use backup codes (hashed)
    backupCodes: {
      type: [String],
      select: false,
    },
    // Pending setup — secret generated but user hasn't verified yet
    pendingSetup: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

twoFactorAuthSchema.index({ user: 1 });

module.exports = mongoose.model('TwoFactorAuth', twoFactorAuthSchema);
