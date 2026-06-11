const User = require('../models/User');
const { adminEmails } = require('../middleware/adminAuth');
const { notify } = require('./notificationService');

/**
 * Resolve the set of admin user ids — the same population requireAdminAuth
 * admits: official accounts (isOfficial) plus anyone in the ADMIN_EMAILS
 * allowlist. Used to fan a moderation-queue notification out to all admins.
 *
 * @returns {Promise<import('mongoose').Types.ObjectId[]>}
 */
async function getAdminUserIds() {
  const emails = adminEmails();
  const or = [{ isOfficial: true }];
  if (emails.length) or.push({ email: { $in: emails } });
  const admins = await User.find({ $or: or }).select('_id').lean();
  return admins.map((a) => a._id);
}

/**
 * Send the same notification to every admin. Best-effort; never throws.
 * Mirrors notificationService.notify's option shape.
 */
async function notifyAdmins(type, opts = {}) {
  try {
    const ids = await getAdminUserIds();
    await Promise.all(ids.map((id) => notify(id, type, opts)));
  } catch (_) {
    /* admin fan-out is best-effort */
  }
}

module.exports = { getAdminUserIds, notifyAdmins };
