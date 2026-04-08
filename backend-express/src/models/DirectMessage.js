const mongoose = require('mongoose');

const directMessageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: { type: String, required: true, maxlength: 200 },
    cost: { type: Number, default: 20 }, // coins spent
    isRead: { type: Boolean, default: false },
    isAccepted: { type: Boolean, default: false },
    acceptedAt: { type: Date, default: null },
    // Replies go in a sub-array to keep it simple
    replies: [
      {
        sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        content: { type: String, maxlength: 200 },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

directMessageSchema.index({ receiver: 1, createdAt: -1 });
directMessageSchema.index({ sender: 1, createdAt: -1 });

module.exports = mongoose.model('DirectMessage', directMessageSchema);
