const mongoose = require('mongoose');

const callLogSchema = new mongoose.Schema(
  {
    caller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['voice', 'video'],
      required: true,
    },
    status: {
      type: String,
      enum: ['missed', 'answered', 'declined', 'ended'],
      default: 'missed',
    },
    duration: { type: Number, default: 0 }, // seconds
    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

callLogSchema.index({ caller: 1, createdAt: -1 });
callLogSchema.index({ receiver: 1, createdAt: -1 });

module.exports = mongoose.model('CallLog', callLogSchema);
