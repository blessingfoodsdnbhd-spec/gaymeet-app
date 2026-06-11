const AdminAction = require('../models/AdminAction');

/**
 * Append one row to the admin audit trail. Best-effort: a logging failure must
 * never break the moderation action itself, so this never throws.
 *
 * @param {object|string} admin   the admin User document (or its id) performing the action
 * @param {string} action         e.g. 'ban', 'delete_photo', 'verify_approve'
 * @param {object} [opts]
 * @param {*} [opts.targetUser]    affected user id
 * @param {string} [opts.targetType]
 * @param {string} [opts.targetId]
 * @param {string} [opts.reason]
 * @param {object} [opts.meta]
 */
async function logAdminAction(admin, action, { targetUser, targetType, targetId, reason, meta } = {}) {
  try {
    await AdminAction.create({
      admin: admin?._id || admin || null,
      adminEmail: admin?.email || '',
      action,
      targetUser: targetUser || null,
      targetType: targetType || null,
      targetId: targetId != null ? String(targetId) : null,
      reason: typeof reason === 'string' ? reason.slice(0, 500) : '',
      meta: meta || {},
    });
  } catch (_) {
    /* audit logging is best-effort — never block the action */
  }
}

module.exports = { logAdminAction };
