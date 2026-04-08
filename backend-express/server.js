require('dotenv').config();
const http = require('http');
const app = require('./src/app');
const { connectDB } = require('./src/config/db');
const { initSocket } = require('./src/services/socketService');
const env = require('./src/config/env');

async function main() {
  await connectDB();

  const server = http.createServer(app);
  initSocket(server);

  server.listen(env.PORT, () => {
    console.log(`🚀 GayMeet server running on port ${env.PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
