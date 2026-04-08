const mongoose = require('mongoose');

const verificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    selfieUrl: { type: String, required: true },
    pose: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    reviewedAt: { type: Date, default: null },
    rejectedReason: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Verification', verificationSchema);
