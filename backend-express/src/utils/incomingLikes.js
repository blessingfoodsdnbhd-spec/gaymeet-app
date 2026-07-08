const Swipe = require('../models/Swipe');

/**
 * Of the given target users, which ones have already liked ("想认识") the
 * viewer? Returns a Set of their string ids. One query for a batch — used to
 * flip the like button to "成为同频" when tapping it would create a match.
 */
async function incomingLikerSet(meId, targetIds) {
  const ids = [...new Set(targetIds.map(String))];
  if (!ids.length) return new Set();
  const rows = await Swipe.find({
    toUser: meId,
    fromUser: { $in: ids },
    direction: { $in: ['like', 'super_like'] },
  }).distinct('fromUser');
  return new Set(rows.map(String));
}

/**
 * Of the given target users, which ones has the viewer already liked
 * ("想认识")? Returns a Set of their string ids. Mirror of incomingLikerSet in
 * the outgoing direction — drives the persistent "已喜欢" (liked) button state
 * so a one-way like survives a cold restart / re-open (before this, only a
 * mutual match or an incoming like persisted; a plain one-way like reverted the
 * button to "想认识"). NOT Premium-gated: whether *I* liked someone is my own
 * action, unlike the incoming-liker reveal which is a Premium feature.
 */
async function outgoingLikeSet(meId, targetIds) {
  const ids = [...new Set(targetIds.map(String))];
  if (!ids.length) return new Set();
  const rows = await Swipe.find({
    fromUser: meId,
    toUser: { $in: ids },
    direction: { $in: ['like', 'super_like'] },
  }).distinct('toUser');
  return new Set(rows.map(String));
}

module.exports = { incomingLikerSet, outgoingLikeSet };
