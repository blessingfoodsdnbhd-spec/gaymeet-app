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
      enum: ['pending', 'approved', 'rejected', 'expired'],
      default: 'pending',
    },
    respondedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// One active request per pair
photoRequestSchema.index({ requester: 1, owner: 1 });
photoRequestSchema.index({ owner: 1, status: 1, createdAt: -1 });
photoRequestSchema.index({ requester: 1, createdAt: -1 });

module.exports = mongoose.model('PhotoRequest', photoRequestSchema);
