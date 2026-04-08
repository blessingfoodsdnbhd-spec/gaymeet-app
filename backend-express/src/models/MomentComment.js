const mongoose = require('mongoose');

const momentCommentSchema = new mongoose.Schema(
  {
    moment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Moment',
      required: true,
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true, maxlength: 200 },
    parentComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MomentComment',
      default: null,
    },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

momentCommentSchema.index({ moment: 1, createdAt: 1 });

module.exports = mongoose.model('MomentComment', momentCommentSchema);
