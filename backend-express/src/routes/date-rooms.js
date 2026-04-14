const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { ok, err } = require('../utils/respond');
const DateRoom = require('../models/DateRoom');
const User = require('../models/User');

// ── POST /api/date-rooms — Create a new room ──────────────────────────────────
router.post('/', auth, async (req, res, next) => {
  try {
    const { durationMinutes } = req.body;
    const duration = parseInt(durationMinutes, 10);
    const cost = DateRoom.COIN_COSTS[duration];
    if (!cost) return err(res, 'Invalid duration. Must be 15, 30, or 60.', 400);

    const host = await User.findById(req.user._id);
    if (!host) return err(res, 'User not found', 404);
    if ((host.coins || 0) < cost) {
      return err(res, `金币不足。需要 ${cost} 金币，当前 ${host.coins || 0} 金币。`, 402);
    }

    // Deduct coins
    host.coins = (host.coins || 0) - cost;
    await host.save();

    // End any existing waiting/active room by this host
    await DateRoom.updateMany(
      { host: req.user._id, status: { $in: ['waiting', 'active'] } },
      { status: 'ended', endedAt: new Date() }
    );

    const room = await DateRoom.create({
      host: req.user._id,
      durationMinutes: duration,
      coinCost: cost,
    });

    ok(res, { room });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/date-rooms/:id/join ─────────────────────────────────────────────
router.post('/:id/join', auth, async (req, res, next) => {
  try {
    const room = await DateRoom.findById(req.params.id)
      .populate('host', 'nickname avatarUrl')
      .populate('guest', 'nickname avatarUrl');

    if (!room) return err(res, 'Room not found', 404);
    if (room.status !== 'waiting') return err(res, 'Room is no longer available', 409);
    if (room.host._id.toString() === req.user._id.toString()) {
      return err(res, 'You cannot join your own room', 400);
    }

    room.guest = req.user._id;
    room.status = 'active';
    room.startedAt = new Date();
    await room.save();

    ok(res, { room });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/date-rooms/:id/end ──────────────────────────────────────────────
router.post('/:id/end', auth, async (req, res, next) => {
  try {
    const room = await DateRoom.findById(req.params.id);
    if (!room) return err(res, 'Room not found', 404);

    const isParticipant =
      room.host.toString() === req.user._id.toString() ||
      (room.guest && room.guest.toString() === req.user._id.toString());
    if (!isParticipant) return err(res, 'Not a participant', 403);

    room.status = 'ended';
    room.endedAt = new Date();
    await room.save();

    ok(res, { ended: true });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/date-rooms/active ────────────────────────────────────────────────
router.get('/active', auth, async (req, res, next) => {
  try {
    const room = await DateRoom.findOne({
      $or: [{ host: req.user._id }, { guest: req.user._id }],
      status: { $in: ['waiting', 'active'] },
    })
      .populate('host', 'nickname avatarUrl isVerified')
      .populate('guest', 'nickname avatarUrl isVerified')
      .lean();

    ok(res, { room: room || null });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/date-rooms/history ────────────────────────────────────────────────
router.get('/history', auth, async (req, res, next) => {
  try {
    const rooms = await DateRoom.find({
      $or: [{ host: req.user._id }, { guest: req.user._id }],
      status: 'ended',
    })
      .sort({ endedAt: -1 })
      .limit(20)
      .populate('host', 'nickname avatarUrl')
      .populate('guest', 'nickname avatarUrl')
      .lean();

    ok(res, { rooms });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/date-rooms/by-code/:code ─────────────────────────────────────────
router.get('/by-code/:code', auth, async (req, res, next) => {
  try {
    const room = await DateRoom.findOne({
      inviteCode: req.params.code.toUpperCase(),
      status: 'waiting',
    })
      .populate('host', 'nickname avatarUrl isVerified')
      .lean();

    if (!room) return err(res, '邀请码无效或房间已结束', 404);
    ok(res, { room });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
