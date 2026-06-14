require('dotenv').config();
const http = require('http');
const app = require('./src/app');
const { connectDB } = require('./src/config/db');
const { initSocket } = require('./src/services/socketService');
const { startNotificationJobs } = require('./src/services/notificationJobs');
const { startRetentionJobs } = require('./src/services/retentionJobs');
const env = require('./src/config/env');

async function main() {
  await connectDB();

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
