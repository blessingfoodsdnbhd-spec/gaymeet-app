const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { ok, err } = require('../utils/respond');
const StickerPack = require('../models/StickerPack');
const User = require('../models/User');

// ── GET /api/stickers/owned ───────────────────────────────────────────────────
// Must be before /:id to avoid route collision
router.get('/owned', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('ownedStickerPacks')
      .lean();
    ok(res, user.ownedStickerPacks || []);
  } catch (e) {
    next(e);
  }
});

// ── GET /api/stickers ─────────────────────────────────────────────────────────
router.get('/', auth, async (req, res, next) => {
  try {
    const packs = await StickerPack.find().sort({ price: 1 }).lean();
    const user = await User.findById(req.user._id).lean();
    const ownedIds = (user.ownedStickerPacks || []).map((id) => id.toString());

    const result = packs.map((p) => ({
      ...p,
      isOwned: ownedIds.includes(p._id.toString()),
    }));

    ok(res, result);
  } catch (e) {
    next(e);
  }
});

// ── GET /api/stickers/:id ─────────────────────────────────────────────────────
router.get('/:id', auth, async (req, res, next) => {
  try {
    const pack = await StickerPack.findById(req.params.id).lean();
    if (!pack) return err(res, 'Pack not found', 404);
    ok(res, pack);
  } catch (e) {
    next(e);
  }
});

// ── POST /api/stickers/:id/purchase ──────────────────────────────────────────
router.post('/:id/purchase', auth, async (req, res, next) => {
  try {
    const pack = await StickerPack.findById(req.params.id).lean();
    if (!pack) return err(res, 'Pack not found', 404);

    const user = await User.findById(req.user._id);
    const ownedIds = (user.ownedStickerPacks || []).map((id) => id.toString());

    if (ownedIds.includes(pack._id.toString())) {
      return err(res, 'Already owned', 400);
    }

    if (pack.price > 0) {
      if (user.coins < pack.price) {
        return err(res, `Insufficient coins. Need ${pack.price} coins.`, 402);
      }
      user.coins -= pack.price;
    }

    user.ownedStickerPacks.push(pack._id);
    await user.save();

    await StickerPack.findByIdAndUpdate(pack._id, {
      $inc: { totalDownloads: 1 },
    });

    ok(res, { purchased: true, packId: pack._id });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
