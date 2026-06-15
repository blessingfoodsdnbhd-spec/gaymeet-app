const mongoose = require('mongoose');

/**
 * 我在的房间 / Room membership — a user's persistent subscription to a custom
 * (user-created) ChatRoom. Created on first entry (and on room creation for the
 * owner) so the room shows under "我在的房间" / "我开的房间" and the user keeps
 * receiving new-message pushes until they explicitly leave.
 *
 * `roomId` is always a 24-hex ChatRoom._id string (official/virtual lobby rooms
 * like 'world' or country codes are NOT subscribed — they're always reachable
 * from the Plaza tabs and would otherwise spam notifications).
 *
 * - notificationsEnabled — per-room mute toggle (静音). The global room-notif
 *   switch lives in NotificationPreference ('world_chat_message' opt-out).
 * - lastReadAt — high-water mark for the unread badge (count of messages newer
 *   than this, from other users).
 */
const roomMembershipSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    roomId: { type: String, required: true }, // ChatRoom._id (24-hex)
    notificationsEnabled: { type: Boolean, default: true },
    lastReadAt: { type: Date, default: Date.now },
    joinedAt: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: false, updatedAt: false } },
);

// One membership per (user, room).
roomMembershipSchema.index({ userId: 1, roomId: 1 }, { unique: true });
// Push fan-out: "everyone subscribed to this room with notifications on".
roomMembershipSchema.index({ roomId: 1, notificationsEnabled: 1 });

module.exports = mongoose.model('RoomMembership', roomMembershipSchema);
