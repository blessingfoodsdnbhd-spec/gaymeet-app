const mongoose = require('mongoose');

/**
 * 小纸条 — an anonymous note. The recipient never learns who sent it; the
 * inbox endpoint strips senderId/sender identity. The sender (who chose the
 * recipient) can see the recipient + any reply in /notes/sent.
 *
 * The recipient may reply exactly once (anonymously), soft-delete the note
 * (deletedByRecipient), or block the hidden sender (blocked + a NoteBlock row).
 */
const noteSchema = new mongoose.Schema(
  {
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, maxlength: 200 },
    // Single anonymous reply from the recipient.
    replyBody: { type: String, maxlength: 200, default: null },
    repliedAt: { type: Date, default: null },
    // Recipient-side state.
    readByRecipient: { type: Boolean, default: false },
    deletedByRecipient: { type: Boolean, default: false },
    blocked: { type: Boolean, default: false },
  },
  { timestamps: true }, // createdAt / updatedAt
);

// Inbox: recipient's live notes, newest-first.
noteSchema.index({ recipientId: 1, deletedByRecipient: 1, createdAt: -1 });
// Sent list + daily quota counting.
noteSchema.index({ senderId: 1, createdAt: -1 });

module.exports = mongoose.model('Note', noteSchema);
