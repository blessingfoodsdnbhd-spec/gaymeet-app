/**
 * Calendar routes
 *
 * GET    /api/calendar          → list events in a date range
 * POST   /api/calendar          → create event
 * PATCH  /api/calendar/:id      → update event
 * DELETE /api/calendar/:id      → delete event
 */

const router = require('express').Router();
const { auth } = require('../middleware/auth');
const CalendarEvent = require('../models/CalendarEvent');
const { ok, created, err } = require('../utils/respond');

// ── GET /api/calendar ─────────────────────────────────────────────────────────
router.get('/', auth, async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const filter = { user: req.user._id };

    if (from || to) {
      filter.startAt = {};
      if (from) filter.startAt.$gte = new Date(from);
      if (to)   filter.startAt.$lte = new Date(to);
    }

    const events = await CalendarEvent.find(filter)
      .sort({ startAt: 1 })
      .lean();

    ok(res, events);
  } catch (e) {
    next(e);
  }
});

// ── POST /api/calendar ────────────────────────────────────────────────────────
router.post('/', auth, async (req, res, next) => {
  try {
    const { title, description, startAt, endAt, allDay, type, color, withUser, location, isPrivate } = req.body;

    if (!title) return err(res, 'title is required');
    if (!startAt) return err(res, 'startAt is required');

    const event = await CalendarEvent.create({
      user: req.user._id,
      title,
      description,
      startAt: new Date(startAt),
      endAt: endAt ? new Date(endAt) : new Date(startAt),
      allDay: allDay ?? false,
      type: type || 'event',
      color: color || '#E91E63',
      withUser: withUser || null,
      location: location || null,
      isPrivate: isPrivate !== false,
    });

    created(res, event);
  } catch (e) {
    next(e);
  }
});

// ── PATCH /api/calendar/:id ───────────────────────────────────────────────────
router.patch('/:id', auth, async (req, res, next) => {
  try {
    const event = await CalendarEvent.findOne({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!event) return err(res, 'Event not found', 404);

    const allowed = ['title', 'description', 'startAt', 'endAt', 'allDay', 'type', 'color', 'location', 'isPrivate'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        event[key] = key === 'startAt' || key === 'endAt'
          ? new Date(req.body[key])
          : req.body[key];
      }
    }
    await event.save();
    ok(res, event);
  } catch (e) {
    next(e);
  }
});

// ── DELETE /api/calendar/:id ──────────────────────────────────────────────────
router.delete('/:id', auth, async (req, res, next) => {
  try {
    const result = await CalendarEvent.deleteOne({
      _id: req.params.id,
      user: req.user._id,
    });
    if (result.deletedCount === 0) return err(res, 'Event not found', 404);
    ok(res, { success: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
