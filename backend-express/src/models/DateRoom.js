const mongoose = require('mongoose');

const COIN_COSTS = { 15: 50, 30: 80, 60: 120 };

const dateRoomSchema = new mongoose.Schema(
  {
    host: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    guest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    status: {
      type: String,
      enum: ['waiting', 'active', 'ended'],
      default: 'waiting',
    },
    durationMinutes: {
      type: Number,
      enum: [15, 30, 60],
      required: true,
    },
    coinCost: { type: Number, required: true },
    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    inviteCode: { type: String, unique: true, sparse: true },
  },
  { timestamps: true }
);

dateRoomSchema.statics.COIN_COSTS = COIN_COSTS;

// Auto-generate invite code
dateRoomSchema.pre('save', function (next) {
  if (!this.inviteCode) {
    this.inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  }
  next();
});

module.exports = mongoose.model('DateRoom', dateRoomSchema);
