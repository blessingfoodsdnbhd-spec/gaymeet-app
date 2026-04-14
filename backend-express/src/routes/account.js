/**
 * Account management routes
 *
 * GET    /api/account/export  → export all user data as JSON
 * DELETE /api/account         → permanently delete account
 */

const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { ok, err } = require('../utils/respond');

const User = require('../models/User');
const Match = require('../models/Match');
const Message = require('../models/Message');
const Moment = require('../models/Moment');
const GiftTransaction = require('../models/GiftTransaction');
const Payment = require('../models/Payment');

// ── GET /api/account/export ───────────────────────────────────────────────────
router.get('/export', auth, async (req, res, next) => {
  try {
    const uid = req.user._id;

    const [matches, messages, moments, gifts, payments] = await Promise.all([
      Match.find({ $or: [{ user1: uid }, { user2: uid }] }).lean(),
      Message.find({ sender: uid }).lean(),
      Moment.find({ user: uid }).lean(),
      GiftTransaction.find({ $or: [{ sender: uid }, { receiver: uid }] }).lean(),
      Payment.find({ user: uid }).lean(),
    ]);

    const profile = req.user.toPublicJSON();

    ok(res, {
      exportedAt: new Date().toISOString(),
      profile,
      matches,
      messages,
      moments,
      gifts,
      payments,
    });
  } catch (e) {
    next(e);
  }
});

// ── DELETE /api/account ───────────────────────────────────────────────────────
router.delete('/', auth, async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password) return err(res, 'password is required to delete account');

    const user = await User.findById(req.user._id).select('+password');
    const valid = await user.comparePassword(password);
    if (!valid) return err(res, 'Incorrect password', 401);

    const uid = req.user._id;

    // Remove all user data (best-effort, non-blocking)
    await Promise.allSettled([
      Match.deleteMany({ $or: [{ user1: uid }, { user2: uid }] }),
      Message.deleteMany({ sender: uid }),
      Moment.deleteMany({ user: uid }),
      GiftTransaction.deleteMany({ $or: [{ sender: uid }, { receiver: uid }] }),
      User.findByIdAndDelete(uid),
    ]);

    ok(res, { success: true, message: 'Account permanently deleted.' });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
