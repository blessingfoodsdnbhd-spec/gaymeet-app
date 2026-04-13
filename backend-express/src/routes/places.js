const router = require('express').Router();
const Place = require('../models/Place');
const PlaceEvent = require('../models/PlaceEvent');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { ok, created, err } = require('../utils/respond');

const FREE_PLACE_LIMIT = 3;
const PAGE_SIZE = 20;

// ── Helper: recalculate averageRating ────────────────────────────────────────
async function recalcRating(placeId) {
  const place = await Place.findById(placeId).select('ratings');
  if (!place) return;
  const total = place.ratings.length;
  const avg = total > 0
    ? place.ratings.reduce((s, r) => s + r.score, 0) / total
    : 0;
  await Place.findByIdAndUpdate(placeId, {
    averageRating: parseFloat(avg.toFixed(2)),
    totalReviews: total,
  });
}

// ── GET /api/places ───────────────────────────────────────────────────────────
// Query: category, city, search, lat, lng, radius (km), sort (distance|rating|newest), page
router.get('/', async (req, res, next) => {
  try {
    const { category, city, search, lat, lng, radius = 10, sort = 'newest', page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * PAGE_SIZE;

    let query = { isActive: true };

    if (category && category !== 'all') query.category = category;
    if (city) query.city = new RegExp(city, 'i');
    if (search) {
      query.$text = { $search: search };
    }

    let places;

    // Geo query takes priority when lat/lng provided
    if (lat && lng) {
      const radiusM = parseFloat(radius) * 1000;
      places = await Place.find({
        ...query,
        location: {
          $near: {
            $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
            $maxDistance: radiusM,
          },
        },
      })
        .populate('user', 'nickname avatarUrl')
        .skip(skip)
        .limit(PAGE_SIZE);
    } else {
      let sortObj = { createdAt: -1 };
      if (sort === 'rating') sortObj = { averageRating: -1, totalReviews: -1 };

      places = await Place.find(query)
        .populate('user', 'nickname avatarUrl')
        .sort(sortObj)
        .skip(skip)
        .limit(PAGE_SIZE);
    }

    const total = await Place.countDocuments(query);

    ok(res, {
      places,
      page: parseInt(page),
      hasMore: skip + places.length < total,
      total,
    });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/places/saved ─────────────────────────────────────────────────────
router.get('/saved', auth, async (req, res, next) => {
  try {
    const places = await Place.find({ likes: req.user._id, isActive: true })
      .populate('user', 'nickname avatarUrl')
      .sort({ updatedAt: -1 })
      .limit(50);
    ok(res, { places });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/places/mine ──────────────────────────────────────────────────────
router.get('/mine', auth, async (req, res, next) => {
  try {
    const places = await Place.find({ user: req.user._id })
      .sort({ createdAt: -1 });
    ok(res, { places });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/places/:id ───────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const place = await Place.findById(req.params.id)
      .populate('user', 'nickname avatarUrl isVerified')
      .populate('ratings.user', 'nickname avatarUrl');
    if (!place || !place.isActive) return err(res, 'Place not found', 404);
    ok(res, { place });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/places ──────────────────────────────────────────────────────────
router.post('/', auth, async (req, res, next) => {
  try {
    const user = req.user;

    // Rate-limit free users
    if (!user.isPremium) {
      const count = await Place.countDocuments({ user: user._id, isActive: true });
      if (count >= FREE_PLACE_LIMIT) {
        return err(res, `Free users can post up to ${FREE_PLACE_LIMIT} places. Upgrade to Premium for unlimited.`, 403);
      }
    }

    const {
      name, description, category, address, city, country,
      phone, website, openingHours, photos, tags, priceRange,
      lat, lng,
    } = req.body;

    if (!name || !category) return err(res, 'name and category are required');

    const place = await Place.create({
      user: user._id,
      name,
      description,
      category,
      address,
      city: city || '',
      country: country || 'MY',
      phone: phone || null,
      website: website || null,
      openingHours: openingHours || null,
      photos: photos ? photos.slice(0, 5) : [],
      tags: tags || [],
      priceRange: priceRange || '$$',
      location: lat && lng
        ? { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] }
        : { type: 'Point', coordinates: [101.6869, 3.1390] }, // default KL
    });

    created(res, { place });
  } catch (e) {
    next(e);
  }
});

// ── PATCH /api/places/:id ─────────────────────────────────────────────────────
router.patch('/:id', auth, async (req, res, next) => {
  try {
    const place = await Place.findById(req.params.id);
    if (!place) return err(res, 'Place not found', 404);
    if (!place.user.equals(req.user._id)) return err(res, 'Not authorized', 403);

    const allowed = ['name', 'description', 'address', 'city', 'phone', 'website',
      'openingHours', 'photos', 'tags', 'priceRange', 'category'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (req.body.lat && req.body.lng) {
      updates.location = { type: 'Point', coordinates: [parseFloat(req.body.lng), parseFloat(req.body.lat)] };
    }

    const updated = await Place.findByIdAndUpdate(req.params.id, updates, { new: true });
    ok(res, { place: updated });
  } catch (e) {
    next(e);
  }
});

// ── DELETE /api/places/:id ────────────────────────────────────────────────────
router.delete('/:id', auth, async (req, res, next) => {
  try {
    const place = await Place.findById(req.params.id);
    if (!place) return err(res, 'Place not found', 404);
    if (!place.user.equals(req.user._id)) return err(res, 'Not authorized', 403);

    await Place.findByIdAndUpdate(req.params.id, { isActive: false });
    ok(res, { success: true });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/places/:id/rate ─────────────────────────────────────────────────
router.post('/:id/rate', auth, async (req, res, next) => {
  try {
    const { score, review } = req.body;
    if (!score || score < 1 || score > 5) return err(res, 'score must be 1-5');

    const place = await Place.findById(req.params.id);
    if (!place || !place.isActive) return err(res, 'Place not found', 404);

    // One review per user — upsert
    const existingIdx = place.ratings.findIndex((r) => r.user.equals(req.user._id));
    if (existingIdx >= 0) {
      place.ratings[existingIdx].score = parseInt(score);
      place.ratings[existingIdx].review = review || '';
    } else {
      place.ratings.push({ user: req.user._id, score: parseInt(score), review: review || '' });
    }

    await place.save();
    await recalcRating(place._id);

    const updated = await Place.findById(place._id).populate('ratings.user', 'nickname avatarUrl');
    ok(res, { place: updated });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/places/:id/like ─────────────────────────────────────────────────
router.post('/:id/like', auth, async (req, res, next) => {
  try {
    const place = await Place.findById(req.params.id);
    if (!place || !place.isActive) return err(res, 'Place not found', 404);

    const idx = place.likes.findIndex((id) => id.equals(req.user._id));
    let liked;
    if (idx >= 0) {
      place.likes.splice(idx, 1);
      liked = false;
    } else {
      place.likes.push(req.user._id);
      liked = true;
    }
    await place.save();
    ok(res, { liked, likesCount: place.likes.length });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/places/:id/events ────────────────────────────────────────────────
router.get('/:id/events', async (req, res, next) => {
  try {
    const events = await PlaceEvent.find({
      place: req.params.id,
      isActive: true,
      date: { $gte: new Date() },
    })
      .populate('user', 'nickname avatarUrl')
      .sort({ date: 1 });
    ok(res, { events });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/places/:id/events ───────────────────────────────────────────────
router.post('/:id/events', auth, async (req, res, next) => {
  try {
    const place = await Place.findById(req.params.id);
    if (!place || !place.isActive) return err(res, 'Place not found', 404);

    const { title, description, date, endDate, price, coverImage } = req.body;
    if (!title || !date) return err(res, 'title and date are required');

    const event = await PlaceEvent.create({
      place: req.params.id,
      user: req.user._id,
      title,
      description: description || '',
      date: new Date(date),
      endDate: endDate ? new Date(endDate) : null,
      price: price || 0,
      coverImage: coverImage || null,
    });

    created(res, { event });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
