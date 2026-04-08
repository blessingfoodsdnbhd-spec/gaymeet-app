const mongoose = require('mongoose');

const swipeSchema = new mongoose.Schema(
  {
    fromUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    toUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    direction: {
      type: String,
      enum: ['like', 'pass', 'super_like'],
      required: true,
    },
  },
  { timestamps: true }
);

swipeSchema.index({ fromUser: 1, toUser: 1 }, { unique: true });
swipeSchema.index({ toUser: 1, direction: 1 }); // for "who liked me" queries

module.exports = mongoose.model('Swipe', swipeSchema);
