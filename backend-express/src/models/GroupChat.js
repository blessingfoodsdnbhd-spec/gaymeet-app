const mongoose = require('mongoose');
const { ObjectId } = mongoose.Schema.Types;

const memberSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: 'User', required: true },
    joinedAt: { type: Date, default: Date.now },
    role: { type: String, enum: ['admin', 'member'], default: 'member' },
  },
  { _id: false }
);

const groupChatSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    description: { type: String, default: '', maxlength: 200 },
    avatar: { type: String, default: null },
    creator: { type: ObjectId, ref: 'User', required: true },
    admins: [{ type: ObjectId, ref: 'User' }],
    members: [memberSchema],
    maxMembers: { type: Number, default: 50 },
    isPublic: { type: Boolean, default: true },
    tags: [{ type: String }],
    lastMessage: { type: String, default: '' },
    lastMessageAt: { type: Date, default: null },
  },
  { timestamps: true }
);

groupChatSchema.index({ isPublic: 1, lastMessageAt: -1 });
groupChatSchema.index({ 'members.user': 1 });

module.exports = mongoose.model('GroupChat', groupChatSchema);
