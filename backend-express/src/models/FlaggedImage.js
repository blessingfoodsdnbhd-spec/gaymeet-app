const mongoose = require('mongoose');

// An image auto-flagged by the NSFW heuristic (item 10), queued for human
// admin review. Non-blocking: the image is already live; admins resolve here.
const flaggedImageSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    url: { type: String, required: true },
    context: { type: String, enum: ['photo', 'moment'], default: 'photo' },
    score: { type: Number, default: null },
    handled: { type: Boolean, default: false },
    // Moderator decision when triaged (REPORT2). null while pending.
    resolutionAction: {
      type: String,
      enum: ['approved', 'content_removed', 'user_banned', 'ip_banned', null],
      default: null,
    },
  },
  { timestamps: true }
);

flaggedImageSchema.index({ handled: 1, createdAt: -1 });

module.exports = mongoose.model('FlaggedImage', flaggedImageSchema);
