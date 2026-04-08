const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema(
  {
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
    isActive: { type: Boolean, default: true },
    // Track the last message for list previews
    lastMessage: { type: String, default: null },
    lastMessageAt: { type: Date, default: null },
    lastMessageBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    // Unread counts per user
    unreadCounts: {
      type: Map,
      of: Number,
      default: {},
    },
  },
  { timestamps: true }
);

matchSchema.index({ users: 1 });
matchSchema.index({ isActive: 1, lastMessageAt: -1 });

module.exports = mongoose.model('Match', matchSchema);
