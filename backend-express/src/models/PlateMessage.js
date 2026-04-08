const mongoose = require('mongoose');

const plateMessageSchema = new mongoose.Schema(
  {
    plateNumber: { type: String, required: true, uppercase: true, trim: true },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: { type: String, required: true, maxlength: 200 },
    isRead: { type: Boolean, default: false },
    isReported: { type: Boolean, default: false },
    reportReason: { type: String, default: null },
    // Sender is blocked by plate owner
    senderBlocked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

plateMessageSchema.index({ plateNumber: 1, createdAt: -1 });
plateMessageSchema.index({ sender: 1, createdAt: -1 }); // for daily limit checks

module.exports = mongoose.model('PlateMessage', plateMessageSchema);
