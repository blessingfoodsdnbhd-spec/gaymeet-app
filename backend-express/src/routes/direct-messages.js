const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { ok, err } = require('../utils/respond');
const DirectMessage = require('../models/DirectMessage');
const User = require('../models/User');

const COST_FREE = 20;
const COST_PREMIUM = 10;

// ── POST /api/dm/send ─────────────────────────────────────────────────────────
router.post('/send', auth, async (req, res, next) => {
  try {
    const { receiverId, content } = req.body;
    if (!receiverId || !content) return err(res, 'receiverId and content required', 400);
    if (content.length > 200) return err(res, 'Content too long (max 200 chars)', 400);

    const sender = req.user;
    // Use same VIP logic as toPublicJSON: vipLevel > 0 with valid expiry counts as premium
    const vipActive =
      (sender.vipLevel > 0) &&
      (!sender.vipExpiresAt || new Date() < new Date(sender.vipExpiresAt));
    const isPremium = vipActive || (sender.isPremium && (!sender.premiumExpiresAt || new Date() < new Date(sender.premiumExpiresAt)));
    const cost = isPremium ? COST_PREMIUM : COST_FREE;

    if (sender.coins < cost) {
      return err(res, `Insufficient coins. Need ${cost} coins.`, 402);
    }

    const receiver = await User.findById(receiverId);
    if (!receiver) return err(res, 'Receiver not found', 404);

    // Deduct coins
    await User.findByIdAndUpdate(sender._id, { $inc: { coins: -cost } });

    const dm = await DirectMessage.create({
      sender: sender._id,
      receiver: receiverId,
      content,
      cost,
    });

    const populated = await dm.populate([
      { path: 'sender', select: 'nickname avatarUrl isVerified' },
      { path: 'receiver', select: 'nickname avatarUrl isVerified' },
    ]);

    ok(res, populated, 201);
  } catch (e) {
    next(e);
  }
});

// ── GET /api/dm/inbox ─────────────────────────────────────────────────────────
router.get('/inbox', auth, async (req, res, next) => {
  try {
    const messages = await DirectMessage.find({ receiver: req.user._id })
      .sort({ createdAt: -1 })
      .populate('sender', 'nickname avatarUrl isVerified isPremium')
      .lean();

    // Blur content for unaccepted messages
    const result = messages.map((m) => ({
      ...m,
      content: m.isAccepted ? m.content : m.content.replace(/./g, '●'),
      blurred: !m.isAccepted,
    }));

    ok(res, result);
  } catch (e) {
    next(e);
  }
});

// ── GET /api/dm/sent ──────────────────────────────────────────────────────────
router.get('/sent', auth, async (req, res, next) => {
  try {
    const messages = await DirectMessage.find({ sender: req.user._id })
      .sort({ createdAt: -1 })
      .populate('receiver', 'nickname avatarUrl isVerified isPremium')
      .lean();
    ok(res, messages);
  } catch (e) {
    next(e);
  }
});

// ── POST /api/dm/:id/accept ───────────────────────────────────────────────────
router.post('/:id/accept', auth, async (req, res, next) => {
  try {
    const dm = await DirectMessage.findOne({
      _id: req.params.id,
      receiver: req.user._id,
    });
    if (!dm) return err(res, 'Message not found', 404);

    dm.isAccepted = true;
    dm.isRead = true;
    dm.acceptedAt = new Date();
    await dm.save();

    ok(res, { accepted: true });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/dm/:id/reply ────────────────────────────────────────────────────
router.post('/:id/reply', auth, async (req, res, next) => {
  try {
    const { content } = req.body;
    if (!content) return err(res, 'content required', 400);
    if (content.length > 200) return err(res, 'Content too long (max 200 chars)', 400);

    const dm = await DirectMessage.findOne({
      _id: req.params.id,
      receiver: req.user._id,
      isAccepted: true,
    });
    if (!dm) return err(res, 'Message not found or not accepted', 404);

    dm.replies.push({ sender: req.user._id, content });
    await dm.save();

    ok(res, { replied: true });
  } catch (e) {
    next(e);
  }
});

// ── DELETE /api/dm/:id ────────────────────────────────────────────────────────
router.delete('/:id', auth, async (req, res, next) => {
  try {
    const dm = await DirectMessage.findOne({
      _id: req.params.id,
      $or: [{ sender: req.user._id }, { receiver: req.user._id }],
    });
    if (!dm) return err(res, 'Message not found', 404);

    await dm.deleteOne();
    ok(res, { deleted: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
