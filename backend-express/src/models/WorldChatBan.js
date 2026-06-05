const mongoose = require('mongoose');

/**
 * A user banned from posting in World Chat (admin moderation, Apple 1.2 UGC).
 * Banned users' messages are also filtered out of everyone's /recent feed.
 */
const worldChatBanSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    bannedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reason: { type: String, default: '' },
  },
  { timestamps: true },
);

module.exports = mongoose.model('WorldChatBan', worldChatBanSchema);
