const mongoose = require('mongoose');

/**
 * User-created topic room (UGC). Anyone can open one; it joins the pool that
 * 热门 ranks from (always BELOW the official rooms). Chat itself flows through
 * the World Chat message/socket system — the room's socket/message id is
 * `user-topic:<_id>`, stored as `roomId` for fast lookups.
 *
 * Lifecycle: a room is auto-deleted after 7 days with no activity (no message
 * sent, nobody entered). `lastActivityAt` is bumped on send + on join; the
 * daily sweep in notificationJobs.js warns the creator 1 day before and then
 * removes it. `archived` hides a room from listings (moderation) without losing
 * the record. `category` is 'topic' for now ('voice' is locked until Phase 4).
 */
const userTopicRoomSchema = new mongoose.Schema(
  {
    // Stable chat/socket room id: `user-topic:<_id>`. Set right after create.
    roomId: { type: String, unique: true, index: true },
    title: { type: String, required: true, maxlength: 30 },
    emoji: { type: String, default: '💬', maxlength: 8 },
    description: { type: String, default: '', maxlength: 100 },
    category: { type: String, enum: ['topic', 'voice'], default: 'topic' },
    creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    archived: { type: Boolean, default: false },
    pinned: { type: Boolean, default: false },
    lastActivityAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Listing: active topic rooms, pinned first, then most recently active.
userTopicRoomSchema.index({ archived: 1, category: 1, pinned: -1, lastActivityAt: -1 });

module.exports = mongoose.model('UserTopicRoom', userTopicRoomSchema);
