const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const env = require('./config/env');
const { globalLimiter, authLimiter } = require('./middleware/rateLimit');

const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const photosRoutes = require('./routes/photos');
const swipesRoutes = require('./routes/swipes');
const matchesRoutes = require('./routes/matches');
const blocksRoutes = require('./routes/blocks');
const subscriptionsRoutes = require('./routes/subscriptions');
const platesRoutes = require('./routes/plates');
const promotionsRoutes = require('./routes/promotions');
const boostRoutes = require('./routes/boost');
const notificationsRoutes = require('./routes/notifications');
const shoutsRoutes = require('./routes/shouts');
const popularRoutes = require('./routes/popular');
const momentsRoutes = require('./routes/moments');
const giftsRoutes = require('./routes/gifts');
const eventsRoutes = require('./routes/events');
const verificationRoutes = require('./routes/verification');
const dmRoutes = require('./routes/direct-messages');
const callsRoutes = require('./routes/calls');
const stickersRoutes = require('./routes/stickers');
const secretCodesRoutes = require('./routes/secret-codes');
const referralsRoutes = require('./routes/referrals');
const placesRoutes = require('./routes/places');
const twoFactorRoutes = require('./routes/two-factor');
const accountRoutes = require('./routes/account');
const calendarRoutes = require('./routes/calendar');
const storiesRoutes = require('./routes/stories');
const followsRoutes = require('./routes/follows');
const energyRoutes = require('./routes/energy');
const questionsRoutes = require('./routes/questions');
const groupsRoutes = require('./routes/groups');
const privatePhotosRoutes = require('./routes/private-photos');
const safeRoutesRoutes = require('./routes/safe-date');
const businessRoutes = require('./routes/business');
const dateRoomsRoutes = require('./routes/date-rooms');

const app = express();

// ── Security & parsing ────────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

const corsOrigin = env.CLIENT_URL === '*'
  ? '*'
  : env.CLIENT_URL.split(',').map((s) => s.trim());
app.use(cors({
  origin: corsOrigin,
  credentials: corsOrigin !== '*',
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── Rate limiting ──────────────────────────────────────────────────────────────
app.use(globalLimiter);

// ── Static uploads ────────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.resolve(env.UPLOAD_DIR)));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ ok: true }));

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/users', photosRoutes);
app.use('/api/swipes', swipesRoutes);
app.use('/api/matches', matchesRoutes);
app.use('/api/users', blocksRoutes);
app.use('/api/subscriptions', subscriptionsRoutes);
app.use('/api/plates', platesRoutes);
app.use('/api/promotions', promotionsRoutes);
app.use('/api/users', boostRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/shouts', shoutsRoutes);
app.use('/api/popular', popularRoutes);
app.use('/api/moments', momentsRoutes);
app.use('/api/gifts', giftsRoutes);
app.use('/api/coins', giftsRoutes); // /api/coins/balance and /api/coins/purchase
app.use('/api/events', eventsRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/dm', dmRoutes);
app.use('/api/calls', callsRoutes);
app.use('/api/stickers', stickersRoutes);
app.use('/api/codes', secretCodesRoutes);
app.use('/api/referrals', referralsRoutes);
app.use('/api/places', placesRoutes);
app.use('/api/2fa', twoFactorRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/stories', storiesRoutes);
app.use('/api/users', followsRoutes);       // /:id/follow, /:id/followers, /:id/following
app.use('/api/energy', energyRoutes);
app.use('/api/questions', questionsRoutes);  // /inbox, /ask/:id, /:id/answer, /user/:id/public
app.use('/api/groups', groupsRoutes);
app.use('/api/users', privatePhotosRoutes); // /private-photos, /:id/request-photos, /:id/private-photos
app.use('/api/photo-requests', privatePhotosRoutes); // /inbox, /sent, /:id/respond
app.use('/api/safe-dates', safeRoutesRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/date-rooms', dateRoomsRoutes);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// ── Global error handler ──────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
});

module.exports = app;
