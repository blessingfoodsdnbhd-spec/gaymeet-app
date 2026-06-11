const mongoose = require('mongoose');

/**
 * A user report against a UGC topic room (title/description/conduct). Mirrors
 * WorldChatReport but targets a room rather than a single message. Denormalizes
 * the room title + creator so the report survives the room's auto-deletion.
 */
const topicRoomReportSchema = new mongoose.Schema(
  {
    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    roomId: { type: String, required: true }, // `user-topic:<id>`
    reportedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // creator
    title: { type: String, default: '' },
    reason: { type: String, default: '' },
    handled: { type: Boolean, default: false },
  },
  { timestamps: true },
);
topicRoomReportSchema.index({ createdAt: -1 });

module.exports = mongoose.model('TopicRoomReport', topicRoomReportSchema);
