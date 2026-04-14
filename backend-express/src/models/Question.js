const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema(
  {
    targetUser:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    senderUser:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    content:     { type: String, required: true, maxlength: 300, trim: true },
    answer:      { type: String, default: null, maxlength: 500, trim: true },
    isAnonymous: { type: Boolean, default: true },
    isPublic:    { type: Boolean, default: false }, // visible on profile when answered
    answeredAt:  { type: Date, default: null },
  },
  { timestamps: true }
);

// Fast inbox query
questionSchema.index({ targetUser: 1, createdAt: -1 });
// Public Q&A for profile
questionSchema.index({ targetUser: 1, isPublic: 1, answeredAt: -1 });

module.exports = mongoose.model('Question', questionSchema);
