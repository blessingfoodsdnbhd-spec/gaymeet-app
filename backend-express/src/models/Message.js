const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    matchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Match',
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: { type: String, required: true, maxlength: 2000 },
    type: { type: String, enum: ['text', 'sticker'], default: 'text' },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    // For future media support
    mediaUrl: { type: String, default: null },
    mediaType: { type: String, enum: ['image', 'gif', null], default: null },
  },
  { timestamps: true }
);

messageSchema.index({ matchId: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);
