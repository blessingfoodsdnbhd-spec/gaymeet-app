const mongoose = require('mongoose');

const followSchema = new mongoose.Schema(
  {
    follower: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    following: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// Unique pair: one user can only follow another once
followSchema.index({ follower: 1, following: 1 }, { unique: true });
// For listing a user's followers efficiently
followSchema.index({ following: 1 });

module.exports = mongoose.model('Follow', followSchema);
