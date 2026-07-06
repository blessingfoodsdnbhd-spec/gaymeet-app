const router = require('express').Router();
const { requireAdminAuth } = require('../middleware/adminAuth');
const Quarantine = require('../models/QuarantineEvent');
const BlockedIp = require('../models/BlockedIp');
const User = require('../models/User');
const VoteEvent = require('../models/VoteEvent');

router.use(requireAdminAuth);

// GET /api/admin/quarantine — pending quarantines, enriched with the affected users.
router.get('/quarantine', async (_req, res, next) => {
  try {
    const pending = await Quarantine.find({ resolvedAt: null }).sort({ triggeredAt: -1 }).limit(200).lean();
    const enriched = [];
    for (const q of pending) {
      const users = await User.find(
        { _id: { $in: q.affectedUserIds || [] } },
        { email: 1, nickname: 1, createdAt: 1, isVerified: 1 }
      ).lean();
      enriched.push({ ...q, users, voteCount: (q.affectedVoteIds || []).length });
    }
    res.json({ pending: enriched, count: enriched.length });
  } catch (e) { next(e); }
});

// POST /api/admin/quarantine/:ip/ban — confirm: block IP + ban all its accounts.
router.post('/quarantine/:ip/ban', async (req, res, next) => {
  try {
    const ip = req.params.ip;
    const q = await Quarantine.findOne({ ip, resolvedAt: null });
    if (!q) return res.status(404).json({ error: 'Quarantine not found' });
    await BlockedIp.updateOne(
      { ip },
      { $set: { ip, reason: 'admin-quarantine-ban', bannedAt: new Date(), bannedBy: req.user?._id || null } },
      { upsert: true }
    );
    await User.updateMany(
      { _id: { $in: q.affectedUserIds } },
      { $set: { isBanned: true, bannedAt: new Date(), bannedReason: 'admin-quarantine-ban' } }
    );
    // votes already hidden at quarantine time — leave hidden.
    q.resolvedAt = new Date();
    q.resolvedBy = req.user?._id || null;
    q.resolution = 'banned';
    await q.save();
    res.json({ ok: true, bannedIp: ip, bannedUsers: (q.affectedUserIds || []).length });
  } catch (e) { next(e); }
});

// POST /api/admin/quarantine/:ip/approve — false alarm: lift suspension + unhide.
router.post('/quarantine/:ip/approve', async (req, res, next) => {
  try {
    const ip = req.params.ip;
    const q = await Quarantine.findOne({ ip, resolvedAt: null });
    if (!q) return res.status(404).json({ error: 'Quarantine not found' });
    await User.updateMany(
      { _id: { $in: q.affectedUserIds } },
      { $set: { postingSuspended: false, postingSuspendedReason: null } }
    );
    await VoteEvent.updateMany(
      { _id: { $in: q.affectedVoteIds }, hiddenReason: 'ip-quarantine' },
      { $set: { hidden: false, hiddenReason: null } }
    );
    // resolution:'approved' within 24h acts as a whitelist in the vote route.
    q.resolvedAt = new Date();
    q.resolvedBy = req.user?._id || null;
    q.resolution = 'approved';
    await q.save();
    res.json({ ok: true, approvedIp: ip, restoredUsers: (q.affectedUserIds || []).length });
  } catch (e) { next(e); }
});

module.exports = router;
