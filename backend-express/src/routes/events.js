const router = require('express').Router();
const Event = require('../models/Event');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { ok, created, err } = require('../utils/respond');

// ── GET /api/events ───────────────────────────────────────────────────────────
router.get('/', auth, async (req, res, next) => {
  try {
    const {
      category,
      lat,
      lng,
      radius = 100000, // 100 km default
      from,
      to,
      page = 1,
      limit = 20,
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const now = new Date();

    let events;

    if (lat && lng) {
      // Geo query
      const matchFilter = {
        isActive: true,
        date: { $gte: now },
      };
      if (category) matchFilter.category = category;
      if (from || to) {
        matchFilter.date = {};
        if (from) matchFilter.date.$gte = new Date(from);
        if (to) matchFilter.date.$lte = new Date(to);
      }

      const pipeline = [
        {
          $geoNear: {
            near: {
              type: 'Point',
              coordinates: [parseFloat(lng), parseFloat(lat)],
            },
            distanceField: 'distanceMeters',
            maxDistance: parseInt(radius),
            spherical: true,
            query: matchFilter,
          },
        },
        { $sort: { date: 1 } },
        { $skip: skip },
        { $limit: parseInt(limit) },
      ];

      events = await Event.aggregate(pipeline);
      // Populate organizer manually after aggregate
      await Event.populate(events, {
        path: 'organizer',
        select: 'nickname avatarUrl isPremium',
      });
    } else {
      const filter = { isActive: true, date: { $gte: now } };
      if (category) filter.category = category;
      if (from || to) {
        filter.date = {};
        if (from) filter.date.$gte = new Date(from);
        if (to) filter.date.$lte = new Date(to);
      }

      events = await Event.find(filter)
        .sort({ date: 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('organizer', 'nickname avatarUrl isPremium')
        .lean();
    }

    const me = req.user._id.toString();
    const result = events.map((e) => {
      const going = (e.attendees || []).filter((a) => a.status === 'going');
      return {
        ...e,
        currentAttendees: going.length,
        isAttending: going.some((a) => a.user?.toString() === me),
        attendees: undefined, // strip from list view
      };
    });

    ok(res, result);
  } catch (e) {
    next(e);
  }
});

// ── GET /api/events/mine ──────────────────────────────────────────────────────
router.get('/mine', auth, async (req, res, next) => {
  try {
    const me = req.user._id;

    const [organized, attending] = await Promise.all([
      Event.find({ organizer: me, isActive: true })
        .sort({ date: 1 })
        .lean(),
      Event.find({
        'attendees.user': me,
        'attendees.status': { $in: ['going', 'interested'] },
        isActive: true,
      })
        .sort({ date: 1 })
        .populate('organizer', 'nickname avatarUrl')
        .lean(),
    ]);

    ok(res, { organized, attending });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/events/:id ───────────────────────────────────────────────────────
router.get('/:id', auth, async (req, res, next) => {
  try {
    const event = await Event.findOne({ _id: req.params.id, isActive: true })
      .populate('organizer', 'nickname avatarUrl isPremium bio')
      .populate('attendees.user', 'nickname avatarUrl')
      .lean();

    if (!event) return err(res, 'Event not found', 404);

    const me = req.user._id.toString();
    const going = event.attendees.filter((a) => a.status === 'going');
    const myRsvp = event.attendees.find((a) => a.user?._id?.toString() === me);

    ok(res, {
      ...event,
      currentAttendees: going.length,
      myStatus: myRsvp?.status ?? null,
      attendees: going.slice(0, 20), // first 20 avatars
    });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/events ──────────────────────────────────────────────────────────
router.post('/', auth, async (req, res, next) => {
  try {
    const {
      title,
      description,
      coverImage,
      venue,
      address,
      lat,
      lng,
      date,
      endDate,
      maxAttendees = 50,
      price = 0,
      currency = 'MYR',
      category = 'hangout',
      tags = [],
    } = req.body;

    if (!title) return err(res, 'title required');
    if (!date) return err(res, 'date required');

    const data = {
      organizer: req.user._id,
      title,
      description,
      coverImage: coverImage ?? null,
      venue: venue ?? '',
      address: address ?? '',
      date: new Date(date),
      endDate: endDate ? new Date(endDate) : null,
      maxAttendees: parseInt(maxAttendees),
      price: parseFloat(price),
      currency,
      category,
      tags,
      // Organizer auto-joins as going
      attendees: [{ user: req.user._id, status: 'going', paidAt: new Date() }],
    };

    if (lat != null && lng != null) {
      data.location = {
        type: 'Point',
        coordinates: [parseFloat(lng), parseFloat(lat)],
      };
    }

    const event = await Event.create(data);
    const populated = await event.populate('organizer', 'nickname avatarUrl');

    created(res, populated);
  } catch (e) {
    next(e);
  }
});

// ── PATCH /api/events/:id ─────────────────────────────────────────────────────
router.patch('/:id', auth, async (req, res, next) => {
  try {
    const event = await Event.findOne({
      _id: req.params.id,
      organizer: req.user._id,
    });
    if (!event) return err(res, 'Event not found or not yours', 404);

    const allowed = [
      'title', 'description', 'coverImage', 'venue', 'address',
      'date', 'endDate', 'maxAttendees', 'price', 'category', 'tags',
    ];
    for (const key of allowed) {
      if (req.body[key] !== undefined) event[key] = req.body[key];
    }

    await event.save();
    ok(res, event);
  } catch (e) {
    next(e);
  }
});

// ── DELETE /api/events/:id ────────────────────────────────────────────────────
router.delete('/:id', auth, async (req, res, next) => {
  try {
    const event = await Event.findOne({
      _id: req.params.id,
      organizer: req.user._id,
    });
    if (!event) return err(res, 'Event not found or not yours', 404);

    event.isActive = false;
    await event.save();

    ok(res, { success: true });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/events/:id/join ─────────────────────────────────────────────────
router.post('/:id/join', auth, async (req, res, next) => {
  try {
    const { status = 'going' } = req.body;
    if (!['going', 'interested'].includes(status)) {
      return err(res, 'status must be going or interested');
    }

    const event = await Event.findOne({ _id: req.params.id, isActive: true });
    if (!event) return err(res, 'Event not found', 404);

    // Check capacity
    const going = event.attendees.filter((a) => a.status === 'going');
    if (status === 'going' && going.length >= event.maxAttendees) {
      return err(res, 'Event is full', 409);
    }

    // Deduct coins if paid event
    if (event.price > 0 && status === 'going') {
      const user = await User.findById(req.user._id);
      // Convert price to coins (1 MYR = 10 coins)
      const coinCost = event.price * 10;
      if (user.coins < coinCost) {
        return res.status(402).json({ error: 'Insufficient coins', required: coinCost });
      }
      await User.findByIdAndUpdate(req.user._id, { $inc: { coins: -coinCost } });
    }

    // Upsert attendee
    const existing = event.attendees.find(
      (a) => a.user?.toString() === req.user._id.toString()
    );
    if (existing) {
      existing.status = status;
      if (status === 'going' && event.price > 0) existing.paidAt = new Date();
    } else {
      event.attendees.push({
        user: req.user._id,
        status,
        paidAt: status === 'going' && event.price > 0 ? new Date() : null,
      });
    }

    await event.save();
    ok(res, { success: true, status, currentAttendees: event.attendees.filter((a) => a.status === 'going').length });
  } catch (e) {
    next(e);
  }
});

// ── DELETE /api/events/:id/leave ──────────────────────────────────────────────
router.delete('/:id/leave', auth, async (req, res, next) => {
  try {
    const event = await Event.findOne({ _id: req.params.id, isActive: true });
    if (!event) return err(res, 'Event not found', 404);

    const existing = event.attendees.find(
      (a) => a.user?.toString() === req.user._id.toString()
    );
    if (existing) existing.status = 'cancelled';

    await event.save();
    ok(res, { success: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
