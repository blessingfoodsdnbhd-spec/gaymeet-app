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
    // View-once: timestamp of the requester's single allowed viewing. Once set,
    // the grant is consumed and the photos lock again.
    viewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// One active request per pair
photoRequestSchema.index({ requester: 1, owner: 1 });
photoRequestSchema.index({ owner: 1, status: 1, createdAt: -1 });
photoRequestSchema.index({ requester: 1, createdAt: -1 });

module.exports = mongoose.model('PhotoRequest', photoRequestSchema);
