const mongoose = require('mongoose');

const momentCommentSchema = new mongoose.Schema(
  {
    moment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Moment',
      required: true,
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // content is optional when the comment carries a photo (photo-only comment).
    content: { type: String, default: '', maxlength: 200 },
    photoUrl: { type: String, default: null },
    parentComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MomentComment',
      default: null,
    },
    // FB-style reactions: emoji → [userId]. One reaction per user (enforced in
    // the route). `likes` is kept as a migration source only — new writes go to
    // `reactions['👍']`.
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    reactions: {
      type: Map,
      of: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      default: () => ({}),
    },
  },
  { timestamps: true }
);

momentCommentSchema.index({ moment: 1, createdAt: 1 });
momentCommentSchema.index({ parentComment: 1 });

module.exports = mongoose.model('MomentComment', momentCommentSchema);
