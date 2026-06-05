const mongoose = require('mongoose');

/**
 * 世界聊天室 / World Chat — a single public broadcast message. Messages
 * auto-expire 7 days after creation via the TTL index; a separate
 * createdAt:-1 index backs reverse-chronological pagination.
 */
const worldChatMessageSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    body: { type: String, required: true, maxlength: 500 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Reverse-chrono history pagination.
worldChatMessageSchema.index({ createdAt: -1 });
// Auto-expire after 7 days.
worldChatMessageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

module.exports = mongoose.model('WorldChatMessage', worldChatMessageSchema);
