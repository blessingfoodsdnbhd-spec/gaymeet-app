const router = require('express').Router();
const { requireAdminAuth } = require('../middleware/adminAuth');
const BlockedIp = require('../models/BlockedIp');
const User = require('../models/User');

// All routes here require admin auth (X-Admin-Token header or an admin Bearer JWT).
router.use(requireAdminAuth);

// POST /api/admin/ban-ip  { ip, reason? }
router.post('/ban-ip', async (req, res, next) => {
  try {
    const ip = String(req.body.ip || '').trim();
    if (!ip) return res.status(400).json({ error: 'IP required' });
    await BlockedIp.updateOne(
      { ip },
      { $set: { ip, reason: req.body.reason || 'admin-manual', bannedBy: req.user?._id || null, bannedAt: new Date() } },
      { upsert: true }
    );
    return res.json({ ok: true, ip });
  } catch (e) { next(e); }
});

// POST /api/admin/ban-user-ip  { userId }  — cascade-ban all IPs on record for a user
router.post('/ban-user-ip', async (req, res, next) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const user = await User.findById(userId, { lastLoginIp: 1, registrationIp: 1, ipAddresses: 1 }).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    const ips = [...new Set([user.lastLoginIp, user.registrationIp, ...(user.ipAddresses || [])].filter(Boolean))];
    for (const ip of ips) {
      await BlockedIp.updateOne(
        { ip },
        { $set: { ip, reason: 'user-ban-cascade', bannedBy: req.user?._id || null, bannedAt: new Date() } },
        { upsert: true }
      );
    }
    return res.json({ ok: true, bannedIps: ips, count: ips.length });
  } catch (e) { next(e); }
});

// DELETE /api/admin/ban-ip/:ip  — unblock
router.delete('/ban-ip/:ip', async (req, res, next) => {
  try {
    await BlockedIp.deleteOne({ ip: req.params.ip });
    return res.json({ ok: true, ip: req.params.ip });
  } catch (e) { next(e); }
});

// GET /api/admin/blocked-ips  — list
router.get('/blocked-ips', async (_req, res, next) => {
  try {
    const list = await BlockedIp.find({}).sort({ bannedAt: -1 }).limit(200).lean();
    return res.json({ list, count: list.length });
  } catch (e) { next(e); }
});

module.exports = router;
