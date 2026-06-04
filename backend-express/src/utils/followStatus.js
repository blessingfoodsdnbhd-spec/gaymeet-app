// Compute the follow relationship between the requester and a set of target
// users, in two queries total (not per-user).
//
//   'mutual'      → I follow them AND they follow me
//   'following'   → I follow them only
//   'followed-by' → they follow me only
//   'none'        → no edge either way

const Follow = require('../models/Follow');

/**
 * @param {ObjectId|string} meId  the requester
 * @param {Array<ObjectId|string>} targetIds
 * @returns {Promise<Map<string,'mutual'|'following'|'followed-by'|'none'>>}
 */
async function followStatusMap(meId, targetIds) {
  const ids = [...new Set(targetIds.map(String))];
  if (!ids.length) return new Map();

  const [outgoing, incoming] = await Promise.all([
    Follow.find({ follower: meId, following: { $in: ids } }).distinct('following'),
    Follow.find({ following: meId, follower: { $in: ids } }).distinct('follower'),
  ]);
  const iFollow = new Set(outgoing.map(String));
  const followsMe = new Set(incoming.map(String));

  const map = new Map();
  for (const id of ids) {
    const a = iFollow.has(id);
    const b = followsMe.has(id);
    map.set(id, a && b ? 'mutual' : a ? 'following' : b ? 'followed-by' : 'none');
  }
  return map;
}

module.exports = { followStatusMap };
