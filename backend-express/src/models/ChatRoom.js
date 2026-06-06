const mongoose = require('mongoose');

/**
 * 聊天室 / ChatRoom — a user-created discussion room that lives inside a country
 * (or the global 'world'). Anyone can create one; rooms can be public or
 * password-protected. Messages live in WorldChatMessage keyed by this room's
 * _id (a 24-hex string), alongside the built-in country rooms.
 */
const chatRoomSchema = new mongoose.Schema(
  {
    creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // The country/world this room belongs to: 'world', 'MY', 'CN', …
    countryCode: { type: String, required: true, index: true },
    title: { type: String, required: true, maxlength: 80 },
    description: { type: String, default: '', maxlength: 300 },
    isPrivate: { type: Boolean, default: false },
    // scrypt "salt:hash" (set only when isPrivate). Never returned to clients.
    passwordHash: { type: String, default: null },
    status: { type: String, enum: ['open', 'closed'], default: 'open' },
    memberIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    messageCount: { type: Number, default: 0 },
    lastActiveAt: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Country room list, freshest first. (creatorId already has a single-field
// index from `index: true` above.)
chatRoomSchema.index({ countryCode: 1, status: 1, lastActiveAt: -1 });

module.exports = mongoose.model('ChatRoom', chatRoomSchema);
