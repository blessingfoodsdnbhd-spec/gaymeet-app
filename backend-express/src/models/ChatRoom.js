const mongoose = require('mongoose');

/**
 * 聊天室 / ChatRoom — a user-created (UGC) discussion room that lives inside a
 * Plaza 二级频道. Phase 4 generalized the parent from "a country" to any channel:
 * `channelId` is a country code ('world','MY',…) OR a friend:/voice:/interest:
 * id. Anyone can create one; rooms are public or password-protected. Messages
 * live in WorldChatMessage keyed by this room's _id (a 24-hex string).
 *
 * `countryCode` is kept for backward-compat with pre-Phase-4 rooms (country
 * UGC) — for those, countryCode === channelId. New rooms always set channelId.
 */
const chatRoomSchema = new mongoose.Schema(
  {
    creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // Parent channel: 'world','MY',… or 'friend:singles','interest:food',…
    channelId: { type: String, index: true },
    // Legacy parent (country UGC). Optional now; mirrors channelId for countries.
    countryCode: { type: String, index: true },
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

// Channel room list, freshest first. (creatorId already has a single-field
// index from `index: true` above.)
chatRoomSchema.index({ channelId: 1, status: 1, lastActiveAt: -1 });
chatRoomSchema.index({ countryCode: 1, status: 1, lastActiveAt: -1 });

module.exports = mongoose.model('ChatRoom', chatRoomSchema);
