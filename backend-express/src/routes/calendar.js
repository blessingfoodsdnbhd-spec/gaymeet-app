const router = require('express').Router();
const CalendarEvent = require('../models/CalendarEvent');
const { ok, err } = require('../utils/respond');

// ── GET /api/calendar?month=6&year=2026 ───────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const month = parseInt(req.query.month, 10);
    const year = parseInt(req.query.year, 10);

    if (!month || !year || month < 1 || month > 12) {
      return err(res, 'month (1-12) and year are required');
    }

    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 1);

    // Regular events in the requested month
    const regularEvents = await CalendarEvent.find({
      recurringYear: false,
      date: { $gte: startOfMonth, $lt: endOfMonth },
    }).sort({ date: 1 }).lean();

    // Recurring events that match the same month (any year)
    const recurringEvents = await CalendarEvent.find({ recurringYear: true }).lean();

    // Filter recurring events to those whose month matches
    const filteredRecurring = recurringEvents
      .filter((e) => new Date(e.date).getMonth() + 1 === month)
      .map((e) => {
        // Clone the event and adjust the date to the requested year
        const originalDate = new Date(e.date);
        const adjustedDate = new Date(year, originalDate.getMonth(), originalDate.getDate());
        return { ...e, date: adjustedDate };
      });

    const allEvents = [...regularEvents, ...filteredRecurring].sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );

    ok(res, { events: allEvents });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/calendar/seed ────────────────────────────────────────────────────
router.get('/seed', async (req, res, next) => {
  try {
    const count = await CalendarEvent.countDocuments();
    if (count > 0) {
      return ok(res, { message: 'Already seeded', count });
    }

    const events = [
      {
        title: 'Pride Month',
        description: 'Celebrate LGBTQ+ Pride Month with events worldwide',
        date: new Date(2000, 5, 1), // June 1 (year doesn't matter for recurring)
        type: 'pride',
        isRecurring: true,
        recurringYear: true,
        emoji: '🏳️‍🌈',
        country: 'GLOBAL',
      },
      {
        title: 'International Day Against Homophobia',
        description: 'IDAHOBIT — standing against discrimination and violence',
        date: new Date(2000, 4, 17), // May 17
        type: 'pride',
        isRecurring: true,
        recurringYear: true,
        emoji: '✊',
        country: 'GLOBAL',
      },
      {
        title: 'World AIDS Day',
        description: 'Remember those lost and support those living with HIV',
        date: new Date(2000, 11, 1), // Dec 1
        type: 'health',
        isRecurring: true,
        recurringYear: true,
        emoji: '🎗️',
        country: 'GLOBAL',
      },
      {
        title: 'Trans Day of Visibility',
        description: 'Celebrating transgender and gender-diverse people',
        date: new Date(2000, 2, 31), // March 31
        type: 'community',
        isRecurring: true,
        recurringYear: true,
        emoji: '🏳️‍⚧️',
        country: 'GLOBAL',
      },
      {
        title: 'Hari Merdeka',
        description: 'Malaysian Independence Day',
        date: new Date(2000, 7, 31), // Aug 31
        type: 'holiday',
        isRecurring: true,
        recurringYear: true,
        emoji: '🇲🇾',
        country: 'MY',
      },
      {
        title: 'Hari Malaysia',
        description: 'Malaysia Day — formation of Malaysia',
        date: new Date(2000, 8, 16), // Sep 16
        type: 'holiday',
        isRecurring: true,
        recurringYear: true,
        emoji: '🇲🇾',
        country: 'MY',
      },
      {
        title: 'Chinese New Year 2026',
        description: 'Lunar New Year celebration',
        date: new Date(2026, 0, 29), // Jan 29 2026
        type: 'holiday',
        isRecurring: false,
        recurringYear: false,
        emoji: '🧧',
        country: 'MY',
      },
      {
        title: 'Deepavali 2026',
        description: 'Festival of Lights',
        date: new Date(2026, 9, 20), // Oct 20 2026
        type: 'holiday',
        isRecurring: false,
        recurringYear: false,
        emoji: '🪔',
        country: 'MY',
      },
      {
        title: 'GayMeet KL Pride Party',
        description: 'Official GayMeet Pride celebration in Kuala Lumpur!',
        date: new Date(2026, 5, 14), // June 14 2026
        type: 'party',
        location: 'Kuala Lumpur',
        isRecurring: false,
        recurringYear: false,
        emoji: '🎉',
        country: 'MY',
      },
      {
        title: 'GayMeet Community Meetup',
        description: 'Monthly community gathering — meet fellow GayMeet members',
        date: new Date(2026, 6, 5), // July 5 2026
        type: 'community',
        isRecurring: false,
        recurringYear: false,
        emoji: '🤝',
        country: 'MY',
      },
    ];

    await CalendarEvent.insertMany(events);
    ok(res, { message: 'Seeded successfully', count: events.length });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
