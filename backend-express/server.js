require('dotenv').config();
const http = require('http');
const app = require('./src/app');
const { connectDB } = require('./src/config/db');
const { initSocket } = require('./src/services/socketService');
const { startNotificationJobs } = require('./src/services/notificationJobs');
const { startRetentionJobs } = require('./src/services/retentionJobs');
const env = require('./src/config/env');

// Build 102 §A — retire the old fixed 7-day TTL on world-chat messages. Mongoose
// won't drop a removed index on its own, so do it once at boot; retention is now
// cron-driven per-room (services/notificationJobs.roomMessageSweep). Idempotent.
async function dropLegacyTTL() {
  try {
    const coll = require('mongoose').connection.collection('worldchatmessages');
    const idx = await coll.indexes();
    if (idx.some((i) => i.name === 'createdAt_1' && i.expireAfterSeconds != null)) {
      await coll.dropIndex('createdAt_1');
      console.log('[migrate] dropped legacy WorldChatMessage TTL index');
    }
  } catch (e) {
    console.warn('[migrate] dropLegacyTTL skipped:', e?.message || e);
  }
}

async function main() {
  await connectDB();
  await dropLegacyTTL();

  const server = http.createServer(app);
  initSocket(server);

  // Re-engagement scheduled jobs (vote deadlines, comeback nudges, daily digests).
  startNotificationJobs();

  // Data-retention cleanup (DISABLED unless RETENTION_ENABLED=true). 30-day DM +
  // ended-contest vote purge. See services/retentionJobs.js.
  startRetentionJobs();

  server.listen(env.PORT, () => {
    console.log(`🚀 GayMeet server running on port ${env.PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
