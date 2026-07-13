// Admin reports dashboard (REPORT1 / REPORT2). Lists unresolved reports across
// content types and lets an admin triage each one with FOUR actions — approve
// (放行), remove-content (删除内容), ban-user (封禁用户), ban-ip (封禁 IP) — plus a
// "view content" affordance (each report carries targetUserId + a content blob
// so the app can enlarge a photo / jump to the moment / vote / user).
//
// Gated by requireAdminAuth (X-Admin-Token header OR a Bearer JWT whose email
// is in ADMIN_EMAILS).
const router = require('express').Router();
const { requireAdminAuth } = require('../middleware/adminAuth');
const { ok, err } = require('../utils/respond');
const WorldChatReport = require('../models/WorldChatReport');
const VoteReport = require('../models/VoteReport');
const UserReport = require('../models/UserReport');
const Message = require('../models/Message');
const FlaggedImage = require('../models/FlaggedImage');
const WorldChatMessage = require('../models/WorldChatMessage');
const VoteEntry = require('../models/VoteEntry');
const VoteEvent = require('../models/VoteEvent');
const Vote = require('../models/Vote');
const User = require('../models/User');
const r2 = require('../services/r2Service');
const { autoBanIp } = require('../utils/ipMassBan');
const { logAdminAction } = require('../services/adminAudit');
const { notify } = require('../services/notificationService');

router.use(requireAdminAuth);

const reasonOf = (req) => String(req.body?.reason || '').slice(0, 500);

// Best-effort blob cleanup for a removed photo URL (R2 key or disk filename).
function deletePhotoBlob(url) {
  try {
    const key = r2.keyFromUrl(url);
    if (key) r2.deleteFile(key).catch(() => {});
  } catch (_) {}
}

// ── GET /api/admin/reports — all unresolved reports, newest first ─────────────
router.get('/reports', async (_req, res, next) => {
  try {
    const [chat, vote, user, scam, images] = await Promise.all([
      WorldChatReport.find({ handled: false })
        .populate('reporterId', 'nickname')
        .populate('reportedUserId', 'nickname')
        .populate('messageId', 'photoUrl body')
        .sort({ createdAt: -1 })
        .limit(200)
        .lean(),
      VoteReport.find({ handled: false })
        .populate('reporterId', 'nickname')
        .populate('entryId', 'submitterId photoUrl caption eventId')
        .populate('eventId', 'creatorId title')
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
        targetUserId: r.reportedUserId?._id ? String(r.reportedUserId._id) : null,
        content: {
          type: 'message',
          text: r.body || r.reason || '',
          imageUrl: r.messageId?.photoUrl || null,
        },
        createdAt: r.createdAt,
      })),
      ...vote.map((r) => {
        const isEntry = r.targetType === 'entry';
        const entry = isEntry && r.entryId && typeof r.entryId === 'object' ? r.entryId : null;
        const ev = !isEntry && r.eventId && typeof r.eventId === 'object' ? r.eventId : null;
        const targetUserId = isEntry ? entry?.submitterId : ev?.creatorId;
        return {
          id: String(r._id),
          kind: 'vote',
          reason: r.reason || '',
          reporter: r.reporterId?.nickname || '—',
          target: isEntry ? '(entry)' : '(event)',
          targetUserId: targetUserId ? String(targetUserId) : null,
          content: {
            type: 'vote',
            voteEntryId: entry?._id ? String(entry._id) : null,
            voteEventId: ev?._id ? String(ev._id) : entry?.eventId ? String(entry.eventId) : null,
            imageUrl: entry?.photoUrl || null,
            text: entry?.caption || ev?.title || '',
          },
          createdAt: r.createdAt,
        };
      }),
      ...user.map((r) => ({
        id: String(r._id),
        kind: 'user',
        reason: `[${r.reason}${r.context && r.context !== 'profile' ? ` · ${r.context}` : ''}]${r.note ? ` ${r.note}` : ''}`,
        reporter: r.reporterId?.nickname || '—',
        target: r.reportedUserId?.nickname || '(user)',
        targetUserId: r.reportedUserId?._id ? String(r.reportedUserId._id) : null,
        content: { type: 'user' },
        createdAt: r.createdAt,
      })),
      ...scam.map((m) => ({
        id: String(m._id),
        kind: 'scamMessage',
        reason: `[${m.flagReason || 'flagged'}] ${(m.content || '').slice(0, 120)}`,
        reporter: '(auto)',
        target: m.senderId?.nickname || '(user)',
        targetUserId: m.senderId?._id ? String(m.senderId._id) : null,
        content: { type: 'message', text: m.content || '' },
        createdAt: m.createdAt,
      })),
      ...images.map((im) => ({
        id: String(im._id),
        kind: 'nsfwImage',
        reason: `skin ${Math.round((im.score || 0) * 100)}% — ${im.url}`,
        reporter: '(auto)',
        target: im.user?.nickname || '(user)',
        targetUserId: im.user?._id ? String(im.user._id) : null,
        content: { type: 'image', imageUrl: im.url },
        createdAt: im.createdAt,
      })),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    ok(res, { reports, count: reports.length });
  } catch (e) {
    next(e);
  }
});

// ── Resolution helpers ────────────────────────────────────────────────────────

// Ban a user account: block login, revoke refresh tokens (kills live sessions),
// and notify them. Returns the user doc, or null if not found.
async function banUserById(userId, reason, adminId) {
  const u = await User.findById(userId);
  if (!u) return null;
  u.isBanned = true;
  u.bannedAt = new Date();
  u.banReason = reason || null;
  u.bannedBy = adminId || null;
  u.refreshToken = null; // revoke sessions — the JWT refresh path now rejects
  await u.save();
  notify(u._id, 'account_banned', {
    title: '账号已被封禁',
    body: reason ? `原因：${reason}` : '你的账号已被管理员封禁。',
    data: { type: 'account_banned' },
  });
  return u;
}

// Mark a report handled with the chosen resolution action. The flag-based
// sources (scamMessage / nsfwImage) use their own handled columns.
async function markReportHandled(kind, report, action, adminId) {
  if (kind === 'scamMessage') {
    report.flagHandled = true;
    report.flagged = false;
    report.resolutionAction = action;
    await report.save();
    return;
  }
  if (kind === 'nsfwImage') {
    report.handled = true;
    report.resolutionAction = action;
    await report.save();
    return;
  }
  report.handled = true;
  report.resolutionAction = action;
  report.handledAt = new Date();
  report.handledBy = adminId || null;
  await report.save();
}

// Resolve a (kind, id) to { report, targetUserId, removeContent } so the four
// action routes share one lookup. removeContent is null when the report targets
// an account rather than a single content item (user-profile reports).
async function loadReportTarget(kind, id) {
  if (kind === 'scamMessage') {
    const m = await Message.findById(id);
    if (!m) return null;
    return {
      report: m,
      targetUserId: m.senderId || null,
      removeContent: async () => {
        await Message.findByIdAndDelete(m._id);
      },
    };
  }
  if (kind === 'nsfwImage') {
    const im = await FlaggedImage.findById(id);
    if (!im) return null;
    return {
      report: im,
      targetUserId: im.user || null,
      removeContent: async () => {
        const owner = await User.findById(im.user);
        if (owner) {
          owner.photos = (owner.photos || []).filter((p) => p !== im.url);
          owner.privatePhotos = (owner.privatePhotos || []).filter((p) => p !== im.url);
          if (owner.avatarUrl === im.url) owner.avatarUrl = owner.photos[0] || null;
          await owner.save();
        }
        deletePhotoBlob(im.url);
      },
    };
  }
  if (kind === 'vote') {
    const r = await VoteReport.findById(id);
    if (!r) return null;
    let targetUserId = null;
    if (r.targetType === 'entry' && r.entryId) {
      const e = await VoteEntry.findById(r.entryId).select('submitterId').lean();
      targetUserId = e?.submitterId || null;
    } else if (r.eventId) {
      const ev = await VoteEvent.findById(r.eventId).select('creatorId').lean();
      targetUserId = ev?.creatorId || null;
    }
    return {
      report: r,
      targetUserId,
      removeContent: async () => {
        if (r.targetType === 'entry' && r.entryId) {
          const entry = await VoteEntry.findById(r.entryId);
          if (entry) {
            const votes = await Vote.deleteMany({ entryId: entry._id });
            await VoteEntry.deleteOne({ _id: entry._id });
            await VoteEvent.updateOne(
              { _id: entry.eventId },
              { $inc: { entryCount: -1, voteCount: -(votes.deletedCount || 0) } },
            );
          }
        } else if (r.eventId) {
          // Events cascade to many entries/votes; hide rather than hard-delete.
          await VoteEvent.updateOne(
            { _id: r.eventId },
            { $set: { hidden: true, hiddenReason: 'admin-report-removed', hiddenAt: new Date() } },
          );
        }
      },
    };
  }
  if (kind === 'worldChat') {
    const r = await WorldChatReport.findById(id);
    if (!r) return null;
    let targetUserId = r.reportedUserId || null;
    if (!targetUserId && r.messageId) {
      const msg = await WorldChatMessage.findById(r.messageId).select('userId').lean();
      targetUserId = msg?.userId || null;
    }
    return {
      report: r,
      targetUserId,
      removeContent: async () => {
        if (r.messageId) await WorldChatMessage.findByIdAndDelete(r.messageId);
      },
    };
  }
  // user-profile report — targets an account, no single content item to remove.
  const r = await UserReport.findById(id);
  if (!r) return null;
  return { report: r, targetUserId: r.reportedUserId || null, removeContent: null };
}

// ── POST /api/admin/reports/:kind/:id/approve — 放行 (mark resolved only) ───────
router.post('/reports/:kind/:id/approve', async (req, res, next) => {
  try {
    const entry = await loadReportTarget(req.params.kind, req.params.id);
    if (!entry) return err(res, 'Report not found', 404);
    await markReportHandled(req.params.kind, entry.report, 'approved', req.user?._id);
    await logAdminAction(req.user, 'report_approve', {
      targetUser: entry.targetUserId || null, targetType: 'report', targetId: req.params.id,
      reason: reasonOf(req), meta: { kind: req.params.kind },
    });
    // Notify reporter their report was reviewed (dismissed / no action).
    if (req.params.kind === 'user' && entry.report.reporterId) {
      notify(entry.report.reporterId, 'report_result', {
        title: '举报已处理', body: '你提交的举报已审核完毕',
        data: { type: 'report_result', role: 'reporter' },
      });
    }
    ok(res, { success: true, resolutionAction: 'approved' });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/admin/reports/:kind/:id/remove-content — 删除内容 ─────────────────
router.post('/reports/:kind/:id/remove-content', async (req, res, next) => {
  try {
    const entry = await loadReportTarget(req.params.kind, req.params.id);
    if (!entry) return err(res, 'Report not found', 404);
    if (!entry.removeContent) {
      return err(res, '该举报针对的是账号，没有可删除的单条内容，请使用封禁用户。', 400);
    }
    await entry.removeContent();
    await markReportHandled(req.params.kind, entry.report, 'content_removed', req.user?._id);
    await logAdminAction(req.user, 'report_remove_content', {
      targetUser: entry.targetUserId || null, targetType: 'report', targetId: req.params.id,
      reason: reasonOf(req), meta: { kind: req.params.kind },
    });
    ok(res, { success: true, resolutionAction: 'content_removed' });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/admin/reports/:kind/:id/ban-user — 封禁用户 ───────────────────────
router.post('/reports/:kind/:id/ban-user', async (req, res, next) => {
  try {
    const entry = await loadReportTarget(req.params.kind, req.params.id);
    if (!entry) return err(res, 'Report not found', 404);
    if (!entry.targetUserId) return err(res, '无法确定被举报用户。', 400);
    const reason = reasonOf(req) || `举报处理（${req.params.kind}）`;
    const banned = await banUserById(entry.targetUserId, reason, req.user?._id);
    if (!banned) return err(res, '被举报用户不存在。', 404);
    await markReportHandled(req.params.kind, entry.report, 'user_banned', req.user?._id);
    await logAdminAction(req.user, 'report_ban_user', {
      targetUser: entry.targetUserId, targetType: 'user', targetId: entry.targetUserId,
      reason, meta: { kind: req.params.kind },
    });
    ok(res, { success: true, resolutionAction: 'user_banned', bannedUserId: String(entry.targetUserId) });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/admin/reports/:kind/:id/ban-ip — 封禁 IP (ban user + IP cascade) ──
router.post('/reports/:kind/:id/ban-ip', async (req, res, next) => {
  try {
    const entry = await loadReportTarget(req.params.kind, req.params.id);
    if (!entry) return err(res, 'Report not found', 404);
    if (!entry.targetUserId) return err(res, '无法确定被举报用户。', 400);
    const reason = reasonOf(req) || `举报处理·IP封禁（${req.params.kind}）`;
    // Ban the account first (revokes its sessions), then cascade the IP: adds it
    // to the BlockedIp blocklist + bans every account seen on that IP + hides
    // their vote events (reuses the existing quarantine mass-ban util).
    await banUserById(entry.targetUserId, reason, req.user?._id);
    const target = await User.findById(entry.targetUserId)
      .select('registrationIp lastLoginIp ipAddresses')
      .lean();
    const ip =
      target?.lastLoginIp || target?.registrationIp || (target?.ipAddresses || [])[0] || null;
    let cascade = null;
    if (ip) cascade = await autoBanIp(ip, reason);
    await markReportHandled(req.params.kind, entry.report, 'ip_banned', req.user?._id);
    await logAdminAction(req.user, 'report_ban_ip', {
      targetUser: entry.targetUserId, targetType: 'ip', targetId: ip || 'unknown',
      reason, meta: { kind: req.params.kind, ip, bannedCount: cascade?.bannedCount || 0 },
    });
    ok(res, { success: true, resolutionAction: 'ip_banned', ip, cascade });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/admin/reports/:kind/:id/resolve — legacy single "mark handled" ──
// Kept for backward-compat with older app builds that only send /resolve. New
// builds use the four action routes above.
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
