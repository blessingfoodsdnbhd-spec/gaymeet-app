// Admin reports dashboard (REPORT1). Lists unresolved reports across content
// types and lets an admin mark them resolved. Gated by requireAdminAuth
// (X-Admin-Token header OR a Bearer JWT whose email is in ADMIN_EMAILS).
const router = require('express').Router();
const { requireAdminAuth } = require('../middleware/adminAuth');
const { ok, err } = require('../utils/respond');
const WorldChatReport = require('../models/WorldChatReport');
const VoteReport = require('../models/VoteReport');
const UserReport = require('../models/UserReport');
const Message = require('../models/Message');
const FlaggedImage = require('../models/FlaggedImage');
const { logAdminAction } = require('../services/adminAudit');
const { notify } = require('../services/notificationService');

router.use(requireAdminAuth);

// ── GET /api/admin/reports — all unresolved reports, newest first ─────────────
router.get('/reports', async (_req, res, next) => {
  try {
    const [chat, vote, user, scam, images] = await Promise.all([
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
      // User-profile reports (filed via POST /api/users/:id/report). Each also
      // auto-blocked the target; surfacing them lets admins review/ban.
      UserReport.find({ handled: false })
        .populate('reporterId', 'nickname')
        .populate('reportedUserId', 'nickname')
        .sort({ createdAt: -1 })
        .limit(200)
        .lean(),
      // Soft-flagged scam/phishing DMs awaiting review (item 11).
      Message.find({ flagged: true, flagHandled: false })
        .populate('senderId', 'nickname')
        .sort({ createdAt: -1 })
        .limit(200)
        .lean(),
      // NSFW-heuristic flagged images awaiting review (item 10).
      FlaggedImage.find({ handled: false })
        .populate('user', 'nickname')
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
      ...user.map((r) => ({
        id: String(r._id),
        kind: 'user',
        reason: `[${r.reason}${r.context && r.context !== 'profile' ? ` · ${r.context}` : ''}]${r.note ? ` ${r.note}` : ''}`,
        reporter: r.reporterId?.nickname || '—',
        target: r.reportedUserId?.nickname || '(user)',
        createdAt: r.createdAt,
      })),
      ...scam.map((m) => ({
        id: String(m._id),
        kind: 'scamMessage',
        reason: `[${m.flagReason || 'flagged'}] ${(m.content || '').slice(0, 120)}`,
        reporter: '(auto)',
        target: m.senderId?.nickname || '(user)',
        createdAt: m.createdAt,
      })),
      ...images.map((im) => ({
        id: String(im._id),
        kind: 'nsfwImage',
        reason: `skin ${Math.round((im.score || 0) * 100)}% — ${im.url}`,
        reporter: '(auto)',
        target: im.user?.nickname || '(user)',
        createdAt: im.createdAt,
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
    if (req.params.kind === 'scamMessage') {
      const m = await Message.findByIdAndUpdate(
        req.params.id,
        { flagHandled: true, flagged: false },
        { new: true },
      );
      if (!m) return err(res, 'Message not found', 404);
      return ok(res, { success: true });
    }
    if (req.params.kind === 'nsfwImage') {
      const im = await FlaggedImage.findByIdAndUpdate(req.params.id, { handled: true }, { new: true });
      if (!im) return err(res, 'Image not found', 404);
      return ok(res, { success: true });
    }
    const Model =
      req.params.kind === 'vote'
        ? VoteReport
        : req.params.kind === 'user'
        ? UserReport
        : WorldChatReport;
    const r = await Model.findByIdAndUpdate(req.params.id, { handled: true }, { new: true });
    if (!r) return err(res, 'Report not found', 404);

    const reason = String(req.body?.reason || '').slice(0, 300);
    const dismissed = req.body?.outcome === 'dismissed'; // else: action taken
    await logAdminAction(req.user, 'report_resolve', {
      targetUser: r.reportedUserId || null, targetType: 'report', targetId: r._id,
      reason, meta: { kind: req.params.kind, outcome: dismissed ? 'dismissed' : 'actioned' },
    });

    // Notify both parties for user-profile reports (reporter + reported).
    if (req.params.kind === 'user') {
      const tail = reason ? `（${reason}）` : '';
      if (r.reporterId) {
        notify(r.reporterId, 'report_result', {
          title: '举报已处理',
          body: dismissed ? `你提交的举报已审核完毕${tail}` : `你举报的用户已被处理${tail}`,
          data: { type: 'report_result', role: 'reporter' },
        });
      }
      if (r.reportedUserId && !dismissed) {
        notify(r.reportedUserId, 'report_result', {
          title: '账号被处理',
          body: `有用户对你的举报已被管理员处理${tail}`,
          data: { type: 'report_result', role: 'reported' },
        });
      }
    }

    ok(res, { success: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
