const mongoose = require('mongoose');

/**
 * TopicUnlock — request/approval relationship between a viewer and an
 * owner that, when status='approved', lets the viewer see ALL of the
 * owner's TopicPersona rows AND the owner's main-profile identity (real
 * nickname, avatar, age, bio) instead of only one topic's persona.
 *
 *   ownerId     – the persona owner; the one being requested-from
 *   viewerId    – the person asking to "see everything"
 *   status      –
 *     'pending'  : the request is open; owner can approve or reject
 *     'approved' : owner accepted; cross-topic visibility unlocked
 *     'rejected' : owner declined; viewer can re-request (replaces row)
 *     'revoked'  : owner had previously approved but later revoked;
 *                  the relationship is dormant; viewer can re-request
 *
 *   requestedAt – mtime of most recent (re-)request
 *   approvedAt  – set when status transitioned to 'approved'
 *   rejectedAt  – set on rejection
 *   revokedAt   – set when owner revokes a previously-approved unlock
 *
 * Compound index { ownerId, viewerId } is UNIQUE — at most one row per
 * pair. Re-requests update the existing row in-place rather than create
 * a duplicate. (See routes/topic-unlocks.js POST /request.)
 */
const topicUnlockSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    viewerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'revoked'],
      default: 'pending',
      index: true,
    },
    requestedAt: { type: Date, default: Date.now },
    approvedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

topicUnlockSchema.index({ ownerId: 1, viewerId: 1 }, { unique: true });
topicUnlockSchema.index({ ownerId: 1, status: 1, requestedAt: -1 });
topicUnlockSchema.index({ viewerId: 1, status: 1, requestedAt: -1 });

module.exports = mongoose.model('TopicUnlock', topicUnlockSchema);
