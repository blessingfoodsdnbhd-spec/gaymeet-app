const mongoose = require('mongoose');

/**
 * A request from `fromUserId` to view `toUserId`'s hidden photos.
 *
 * Distinct from PhotoRequest (private-photos, view-once, Premium-gated):
 * hidden photos are a subset of the owner's OWN profile photos flagged
 * hidden, and an approval creates a PERSISTENT grant (User.hiddenPhotoGrants)
 * rather than a single view. The row here is the request lifecycle + audit
 * trail; the live access check reads hiddenPhotoGrants.
 *
 * Statuses:
 *   pending   — awaiting the owner's decision
 *   approved  — owner said yes (grant written to User.hiddenPhotoGrants)
 *   rejected  — owner said no (kept as audit; requester can try again next day)
 */
const hiddenPhotoRequestSchema = new mongoose.Schema(
  {
    fromUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    toUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    respondedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Owner inbox (谁申请了我的) + status filter, newest first.
hiddenPhotoRequestSchema.index({ toUserId: 1, status: 1, createdAt: -1 });
// Requester lookups (my sent requests) + per-pair dedupe / rate-limit reads.
hiddenPhotoRequestSchema.index({ fromUserId: 1, toUserId: 1, createdAt: -1 });
// At most ONE pending request per (from, to) pair. approved/rejected rows are
// kept as history and don't collide (partial index on status='pending').
hiddenPhotoRequestSchema.index(
  { fromUserId: 1, toUserId: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } },
);

module.exports = mongoose.model('HiddenPhotoRequest', hiddenPhotoRequestSchema);
