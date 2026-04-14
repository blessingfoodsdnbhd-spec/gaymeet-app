const mongoose = require('mongoose');

const energySchema = new mongoose.Schema(
  {
    sender:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount:   { type: Number, default: 1 },
  },
  { timestamps: true }
);

energySchema.index({ sender: 1, createdAt: -1 });
energySchema.index({ receiver: 1, createdAt: -1 });

module.exports = mongoose.model('Energy', energySchema);
