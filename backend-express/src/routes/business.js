const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { ok, err } = require('../utils/respond');
const BusinessProfile = require('../models/BusinessProfile');

// ── POST /api/business/register ───────────────────────────────────────────────
router.post('/register', auth, async (req, res, next) => {
  try {
    const existing = await BusinessProfile.findOne({ user: req.user._id });
    if (existing) return err(res, '您已注册商家账户', 409);

    const { businessName, category, description, address, phone, website, openingHours } = req.body;
    if (!businessName || !category) {
      return err(res, 'businessName and category are required', 400);
    }

    const profile = await BusinessProfile.create({
      user: req.user._id,
      businessName,
      category,
      description: description || '',
      address: address || '',
      phone: phone || null,
      website: website || null,
      openingHours: openingHours || null,
    });

    ok(res, { profile }, 201);
  } catch (e) {
    next(e);
  }
});

// ── GET /api/business/profile ─────────────────────────────────────────────────
router.get('/profile', auth, async (req, res, next) => {
  try {
    const profile = await BusinessProfile.findOne({ user: req.user._id }).lean();
    if (!profile) return err(res, '未找到商家资料', 404);
    ok(res, { profile: { ...profile, isPromoted: profile.promotedUntil && profile.promotedUntil > new Date() } });
  } catch (e) {
    next(e);
  }
});

// ── PATCH /api/business/profile ───────────────────────────────────────────────
router.patch('/profile', auth, async (req, res, next) => {
  try {
    const allowed = ['businessName', 'category', 'description', 'address', 'phone', 'website', 'openingHours'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const profile = await BusinessProfile.findOneAndUpdate(
      { user: req.user._id },
      updates,
      { new: true }
    );
    if (!profile) return err(res, '未找到商家资料', 404);
    ok(res, { profile });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/business/promote ─────────────────────────────────────────────────
// plan: 'weekly' (RM50) | 'monthly' (RM150)
router.post('/promote', auth, async (req, res, next) => {
  try {
    const { plan } = req.body;
    if (!['weekly', 'monthly'].includes(plan)) {
      return err(res, "plan must be 'weekly' or 'monthly'", 400);
    }

    const profile = await BusinessProfile.findOne({ user: req.user._id });
    if (!profile) return err(res, '请先注册商家账户', 404);

    const now = new Date();
    const base = profile.promotedUntil && profile.promotedUntil > now
      ? profile.promotedUntil
      : now;

    const days = plan === 'weekly' ? 7 : 30;
    const newExpiry = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
    profile.promotedUntil = newExpiry;
    await profile.save();

    ok(res, {
      promotedUntil: newExpiry,
      plan,
      price: plan === 'weekly' ? 50 : 150,
      currency: 'MYR',
    });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/business/dashboard ───────────────────────────────────────────────
router.get('/dashboard', auth, async (req, res, next) => {
  try {
    const profile = await BusinessProfile.findOne({ user: req.user._id }).lean();
    if (!profile) return err(res, '未找到商家资料', 404);

    ok(res, {
      profile: { ...profile, isPromoted: profile.promotedUntil && profile.promotedUntil > new Date() },
      stats: {
        totalViews: profile.totalViews,
        totalClicks: profile.totalClicks,
        weeklyViews: profile.weeklyViews,
      },
    });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/business/promoted ────────────────────────────────────────────────
// Public: returns promoted businesses for display in places screen
router.get('/promoted', async (req, res, next) => {
  try {
    const now = new Date();
    const businesses = await BusinessProfile.find({
      promotedUntil: { $gt: now },
      isActive: true,
    })
      .populate('user', 'nickname avatarUrl')
      .lean();

    // Increment view counts
    const ids = businesses.map((b) => b._id);
    await BusinessProfile.updateMany(
      { _id: { $in: ids } },
      { $inc: { totalViews: 1, weeklyViews: 1 } }
    );

    ok(res, {
      businesses: businesses.map((b) => ({
        ...b,
        isPromoted: true,
      })),
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
