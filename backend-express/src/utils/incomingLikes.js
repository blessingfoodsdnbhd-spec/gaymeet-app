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

module.exports = { incomingLikerSet };
