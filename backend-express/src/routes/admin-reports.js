// Admin reports dashboard (REPORT1). Lists unresolved reports across content
// types and lets an admin mark them resolved. Gated by requireAdminAuth
// (X-Admin-Token header OR a Bearer JWT whose email is in ADMIN_EMAILS).
const router = require('express').Router();
const { requireAdminAuth } = require('../middleware/adminAuth');
const { ok, err } = require('../utils/respond');
const WorldChatReport = require('../models/WorldChatReport');
const VoteReport = require('../models/VoteReport');

router.use(requireAdminAuth);

// ── GET /api/admin/reports — all unresolved reports, newest first ─────────────
router.get('/reports', async (_req, res, next) => {
  try {
    const [chat, vote] = await Promise.all([
      WorldChatReport.find({ handled: false })
        .populate('reporterId', 'nickname')
        .populate('reportedUserId', 'nickname')
        .sort({ createdAt: -1 })
        .limit(200)
        .lean(),
      VoteReport.find({ handled: false })
        .populate('reporterId', 'nickname')
        .sort({ createdAt: -1 })
        .limit(200)
        .lean(),
    ]);

    const reports = [
      ...chat.map((r) => ({
        id: String(r._id),
        kind: 'worldChat',
        reason: r.reason || r.body || '',
        reporter: r.reporterId?.nickname || '—',
        target: r.reportedUserId?.nickname || '(message)',
        createdAt: r.createdAt,
      })),
      ...vote.map((r) => ({
        id: String(r._id),
        kind: 'vote',
        reason: r.reason || '',
        reporter: r.reporterId?.nickname || '—',
        target: r.targetType === 'entry' ? '(entry)' : '(event)',
        createdAt: r.createdAt,
      })),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    ok(res, { reports, count: reports.length });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/admin/reports/:kind/:id/resolve — mark handled ──────────────────
router.post('/reports/:kind/:id/resolve', async (req, res, next) => {
  try {
    const Model = req.params.kind === 'vote' ? VoteReport : WorldChatReport;
    const r = await Model.findByIdAndUpdate(req.params.id, { handled: true }, { new: true });
    if (!r) return err(res, 'Report not found', 404);
    ok(res, { success: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;

// Follow-up: user-profile reports (POST /api/users/:id/report in blocks.js)
// currently only auto-block and are NOT persisted to a collection, so they
// don't appear here. Add a UserReport model + write there to surface them.
