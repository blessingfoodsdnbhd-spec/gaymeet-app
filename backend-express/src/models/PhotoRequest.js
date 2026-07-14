const mongoose = require('mongoose');

const photoRequestSchema = new mongoose.Schema(
  {
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      // 'viewed' = approved grant consumed by the requester's one-time view.
      enum: ['pending', 'approved', 'rejected', 'expired', 'revoked', 'viewed'],
      default: 'pending',
    },
    respondedAt: { type: Date, default: null },
    // Legacy view-once timestamp. Grants are now PERMANENT (approved stays
    // approved until the owner revokes), so this is no longer written for new
    // grants — kept for backward-compat with any pre-existing 'viewed' rows.
    viewedAt: { type: Date, default: null },
    // When the owner revoked this (previously approved) grant. status flips to
    // 'revoked' at the same time; kept for audit + to drive re-request cooldown.
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// One active request per pair
photoRequestSchema.index({ requester: 1, owner: 1 });
photoRequestSchema.index({ owner: 1, status: 1, createdAt: -1 });
photoRequestSchema.index({ requester: 1, createdAt: -1 });

module.exports = mongoose.model('PhotoRequest', photoRequestSchema);
