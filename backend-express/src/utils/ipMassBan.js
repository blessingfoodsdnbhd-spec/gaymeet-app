const BlockedIp = require('../models/BlockedIp');
const User = require('../models/User');
const VoteEvent = require('../models/VoteEvent');

/**
 * Auto-ban an IP and cascade:
 *   1. add the IP to the blocklist (blocks all future requests from it)
 *   2. ban every user ever seen on that IP (registrationIp/lastLoginIp/ipAddresses)
 *   3. hide every vote-event created from that IP
 *
 * Returns a summary and logs it so admins can review/reverse.
 *
 * ⚠️ COLLATERAL RISK: shared IPs (office wifi, university, mobile carrier CGNAT)
 * can put many unrelated legitimate users behind one IP. This will ban all of
 * them. The [ip-mass-ban] log line lists every affected email for review.
 */
async function autoBanIp(ip, reason) {
  const summary = { ip, reason, bannedUsers: [], bannedCount: 0, hiddenVotes: 0 };
  if (!ip) return summary;

  await BlockedIp.updateOne(
    { ip },
    { $set: { ip, reason, bannedAt: new Date(), bannedBy: null } },
    { upsert: true }
  );

  const users = await User.find(
    { $or: [{ registrationIp: ip }, { lastLoginIp: ip }, { ipAddresses: ip }] },
    { _id: 1, email: 1, nickname: 1 }
  ).lean();

  if (users.length) {
    const banned = await User.updateMany(
      { _id: { $in: users.map((u) => u._id) }, isBanned: { $ne: true } },
      { $set: { isBanned: true, bannedAt: new Date(), bannedReason: reason } }
    );
    summary.bannedCount = banned.modifiedCount;
    summary.bannedUsers = users.map((u) => u.email || u.nickname || String(u._id));
  }

  const hidden = await VoteEvent.updateMany(
    { createdIp: ip, hidden: { $ne: true } },
    { $set: { hidden: true, hiddenReason: 'ip-mass-ban-cascade', hiddenAt: new Date() } }
  );
  summary.hiddenVotes = hidden.modifiedCount;

  console.warn('[ip-mass-ban]', JSON.stringify(summary));
  return summary;
}

module.exports = { autoBanIp };
