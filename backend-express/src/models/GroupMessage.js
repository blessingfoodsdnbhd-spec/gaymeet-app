const mongoose = require('mongoose');
const { ObjectId } = mongoose.Schema.Types;

const groupMessageSchema = new mongoose.Schema(
  {
    group: { type: ObjectId, ref: 'GroupChat', required: true },
    sender: { type: ObjectId, ref: 'User', required: true },
    content: { type: String, default: '' },
    type: {
      type: String,
      enum: ['text', 'sticker', 'image', 'system'],
      default: 'text',
    },
  },
  { timestamps: true }
);

groupMessageSchema.index({ group: 1, createdAt: -1 });

module.exports = mongoose.model('GroupMessage', groupMessageSchema);
