// Auto-hide moderation engine (option A: UNIQUE reporter count).
//
// A piece of UGC content (moment / vote event / vote entry) is auto-hidden once
// THREE DISTINCT users report it. Distinctness is guaranteed by the unique index
// on ContentReport(reporterId, targetType, targetId): a duplicate report from the
// same user is a silent no-op and never bumps the counter.
//
// `hidden` content is filtered out of every public feed (see hiddenFilter()),
// but the author still sees their own post with an "审核中" badge, and admins can
// unhide or delete it from the moderation dashboard.
const mongoose = require('mongoose');
const ContentReport = require('../models/ContentReport');
const { isAdminUser } = require('../middleware/adminAuth');

// How many UNIQUE reporters auto-hide a target.
const AUTO_HIDE_THRESHOLD = 3;
// The three distinct hide reasons surfaced to the admin dashboard:
const HIDDEN_REASON = 'auto-hide-3-reports'; // 3 distinct normal users reported
const ADMIN_REPORT_REASON = 'admin-report'; // an admin reported (weight = 3 → immediate)
const ADMIN_MANUAL_REASON = 'admin-manual'; // an admin hid it directly from the dashboard

// targetType → { Model, ownerField } so we can $inc the right collection and,
// when hiding, notify the author.
function resolveTarget(targetType) {
  switch (targetType) {
    case 'moment':
      return { Model: require('../models/Moment'), ownerField: 'user' };
    case 'voteEvent':
      return { Model: require('../models/VoteEvent'), ownerField: 'creatorId' };
    case 'voteEntry':
      return { Model: require('../models/VoteEntry'), ownerField: 'submitterId' };
    default:
      return null;
  }
}

/**
 * Build a Mongo filter fragment that hides auto-hidden content from everyone
 * EXCEPT its author. Spread into an existing query's `$and`, or merge directly.
 *
 *   Moment.find({ ...base, ...hiddenFilter(req.user._id, 'user') })
 *
 * `hidden: { $ne: true }` (not `hidden: false`) so legacy docs that predate the
 * field — where `hidden` is absent — are correctly treated as visible without a
 * backfill. Author-owned docs are always visible to the author (审核中 badge).
 */
function hiddenFilter(viewerId, ownerField = 'user') {
  const conds = [{ hidden: { $ne: true } }];
  if (viewerId) conds.push({ [ownerField]: viewerId });
  return { $or: conds };
}

/**
 * Record one report against a target and auto-hide it at the unique-reporter
 * threshold. Idempotent per (reporter, target): a repeat report resolves without
 * error and without double-counting.
 *
 * @returns {Promise<{counted:boolean, reportCount:number, hidden:boolean, hiddenNow:boolean}>}
 *   counted  — true if this was a NEW report (false = duplicate, silently accepted)
 *   hiddenNow — true only on the call that crossed the threshold (for notifying once)
 */
async function recordContentReport({ reporterId, reporter, byAdmin, targetType, targetId, reason = '' }) {
  const resolved = resolveTarget(targetType);
  if (!resolved) throw new Error(`Unknown report targetType: ${targetType}`);
  if (!mongoose.isValidObjectId(targetId)) throw new Error('Invalid targetId');
  const { Model, ownerField } = resolved;

  // Admin reporters carry weight 3 — a single admin report hides the target now.
  // Derive from the passed `reporter` user doc (isOfficial / ADMIN_EMAILS) unless
  // the caller states it explicitly.
  const isAdmin = typeof byAdmin === 'boolean' ? byAdmin : isAdminUser(reporter);

  // Insert the report; a duplicate (same user + target) is a silent no-op.
  let counted = true;
  try {
    await ContentReport.create({
      reporterId,
      targetType,
      targetId,
      reason: String(reason || '').slice(0, 300),
      byAdmin: isAdmin,
    });
  } catch (e) {
    if (e && e.code === 11000) {
      counted = false; // already reported by this user
    } else {
      throw e;
    }
  }

  // Only a NEW report changes state.
  if (!counted) {
    const doc = await Model.findById(targetId).select('reportCount hidden').lean();
    return {
      counted: false,
      reportCount: doc?.reportCount ?? 0,
      hidden: !!doc?.hidden,
      hiddenNow: false,
    };
  }

  // Bump the denormalized counter on the target.
  const updated = await Model.findByIdAndUpdate(
    targetId,
    { $inc: { reportCount: 1 } },
    { new: true },
  )
    .select(`reportCount hidden moderationLocked ${ownerField}`)
    .lean();

  if (!updated) {
    // Target vanished between report + increment; nothing to hide.
    return { counted: true, reportCount: 0, hidden: false, hiddenNow: false };
  }

  // Decide whether this report hides the target:
  //   - admin report  → hide immediately (bypasses moderationLocked; a deliberate
  //                      admin action overrides a prior admin unhide).
  //   - normal report → hide at 3 unique reporters, unless an admin previously
  //                      unhid it (moderationLocked).
  let hiddenNow = false;
  if (!updated.hidden) {
    const shouldHide = isAdmin
      ? true
      : !updated.moderationLocked && (updated.reportCount || 0) >= AUTO_HIDE_THRESHOLD;
    if (shouldHide) {
      // Guard against a double-hide race: only the update that flips hidden
      // false→true "wins" and fires the notification.
      const res = await Model.updateOne(
        { _id: targetId, hidden: { $ne: true } },
        {
          $set: {
            hidden: true,
            hiddenReason: isAdmin ? ADMIN_REPORT_REASON : HIDDEN_REASON,
            hiddenAt: new Date(),
          },
        },
      );
      hiddenNow = (res.modifiedCount || res.nModified || 0) > 0;
      if (hiddenNow) notifyAuthorHidden(targetType, updated[ownerField]).catch(() => {});
    }
  }

  return {
    counted: true,
    reportCount: updated.reportCount || 0,
    hidden: updated.hidden || hiddenNow,
    hiddenNow,
  };
}

// Best-effort push/notification to the author that their content was hidden
// pending review. Never throws into the caller.
async function notifyAuthorHidden(targetType, ownerId) {
  if (!ownerId) return;
  try {
    const { notify } = require('./notificationService');
    const label =
      targetType === 'moment' ? '动态' : targetType === 'voteEvent' ? '投票活动' : '投票作品';
    await notify(ownerId, 'content_hidden', {
      title: '内容已暂时隐藏',
      body: `你的${label}因多次举报已被暂时隐藏，正在等待管理员审核。`,
      data: { type: 'content_hidden', targetType },
    });
  } catch (_) {
    // notification is best-effort
  }
}

module.exports = {
  AUTO_HIDE_THRESHOLD,
  HIDDEN_REASON,
  ADMIN_REPORT_REASON,
  ADMIN_MANUAL_REASON,
  recordContentReport,
  hiddenFilter,
  resolveTarget,
};
