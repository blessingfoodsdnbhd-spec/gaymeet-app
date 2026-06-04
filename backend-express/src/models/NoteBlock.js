const mongoose = require('mongoose');

/**
 * A recipient blocking the (hidden) sender of a 小纸条. Because the inbox is
 * anonymous, the recipient blocks "whoever sent this" without learning their
 * identity. Future notes from blockedUserId → blockerUserId are rejected.
 */
const noteBlockSchema = new mongoose.Schema(
  {
    blockerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    blockedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

noteBlockSchema.index({ blockerUserId: 1, blockedUserId: 1 }, { unique: true });

module.exports = mongoose.model('NoteBlock', noteBlockSchema);
