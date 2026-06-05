const mongoose = require('mongoose');

/**
 * A single cast vote. Per-event rules ('one' / 'fivePerDay' / 'unlimited') are
 * enforced in the route; the unique {voterId, entryId} index always prevents
 * voting the SAME entry twice regardless of mode.
 */
const voteSchema = new mongoose.Schema(
  {
    voterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'VoteEvent', required: true, index: true },
    entryId: { type: mongoose.Schema.Types.ObjectId, ref: 'VoteEntry', required: true, index: true },
  },
  { timestamps: true },
);

voteSchema.index({ voterId: 1, eventId: 1 });
voteSchema.index({ voterId: 1, entryId: 1 }, { unique: true });

module.exports = mongoose.model('Vote', voteSchema);
