/**
 * Report-based auto-hide (anti-spam Phase 1, defense #4).
 *
 * When a single content item is reported by N distinct users within a rolling
 * window, it is auto-hidden: invisible to everyone except the author and
 * admins, and queued for admin review (Restore / Confirm / Escalate) via the
 * admin moderation endpoints.
 *
 * The three report collections have different shapes, so callers pass the
 * report model + the match that identifies "reports about THIS item":
 *   - WorldChatReport → { messageId }            → WorldChatMessage
 *   - VoteReport      → { targetType:'entry', entryId } → VoteEntry
 *   - VoteReport      → { targetType:'event', eventId } → VoteEvent
 *
 * Distinct reporters are counted (not raw reports) so one user spam-reporting
 * can't trip the threshold alone. Self-reports are excluded by the routes that
 * forbid reporting your own content.
 */

const AUTO_HIDE_THRESHOLD = 3; // distinct reporters
const WINDOW_MS = 7 * 24 * 3600 * 1000; // 7 days

/** Count distinct reporters for a content target within the rolling window. */
async function distinctReporterCount(ReportModel, match, field = 'reporterId') {
  const since = new Date(Date.now() - WINDOW_MS);
  const ids = await ReportModel.distinct(field, { ...match, createdAt: { $gte: since } });
  return ids.length;
}

/**
 * Hide the content if it isn't already hidden. Idempotent — the conditional
 * update means concurrent reports can't double-hide or clobber an admin's
 * earlier `restored`/`confirmed` decision (those leave `hidden` set per status,
 * and a restored item has hidden:false so it CAN be re-hidden on fresh reports).
 * @returns {Promise<boolean>} whether this call hid the item.
 */
async function maybeAutoHide(ContentModel, contentId, count) {
  if (count < AUTO_HIDE_THRESHOLD) return false;
  const r = await ContentModel.updateOne(
    { _id: contentId, hidden: { $ne: true }, moderationStatus: { $ne: 'confirmed' } },
    {
      $set: {
        hidden: true,
        autoHiddenAt: new Date(),
        autoHiddenReason: `${count} reports`,
        moderationStatus: 'auto_hidden',
      },
    },
  );
  return r.modifiedCount > 0;
}

/**
 * Count distinct reporters for a target and auto-hide if the threshold is met.
 * Best-effort: callers should not let a moderation failure break the report
 * write. Returns { count, hidden }.
 */
async function evaluateReport({ ReportModel, reportMatch, ContentModel, contentId }) {
  const count = await distinctReporterCount(ReportModel, reportMatch);
  const hidden = await maybeAutoHide(ContentModel, contentId, count);
  return { count, hidden };
}

module.exports = {
  AUTO_HIDE_THRESHOLD,
  WINDOW_MS,
  distinctReporterCount,
  maybeAutoHide,
  evaluateReport,
};
