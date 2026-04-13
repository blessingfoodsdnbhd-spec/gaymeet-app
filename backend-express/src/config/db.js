const mongoose = require('mongoose');
const env = require('./env');

async function connectDB() {
  mongoose.set('strictQuery', false);

  try {
    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10_000, // fail fast instead of hanging 30s
    });
    console.log('✅ MongoDB connected:', mongoose.connection.host);
  } catch (err) {
    console.error('\n❌ MongoDB connection failed:', err.message);

    // Friendly diagnosis based on error type
    if (err.message.includes('ENOTFOUND') || err.message.includes('querySrv')) {
      console.error(
        '\n  The cluster hostname could not be resolved (DNS error).\n' +
        '  This almost always means the cluster ID in your MONGODB_URI is wrong.\n' +
        '\n  Fix:\n' +
        '    1. Log into MongoDB Atlas → your project → click "Connect" on your cluster\n' +
        '    2. Choose "Drivers" → copy the connection string\n' +
        '    3. Replace <password> with your actual password\n' +
        '    4. Update MONGODB_URI on Render: Service → Environment\n' +
        '\n  Also check:\n' +
        '    • Cluster not paused (Atlas free tier pauses after 60 days idle)\n' +
        '    • Render outbound IP is allowed in Atlas → Network Access (add 0.0.0.0/0)\n'
      );
    } else if (err.message.includes('Authentication failed') || err.message.includes('bad auth')) {
      console.error(
        '\n  Authentication failed — wrong username or password in the URI.\n' +
        '  If your password has special characters, URL-encode them:\n' +
        '    @  →  %40\n' +
        '    #  →  %23\n' +
        '    $  →  %24\n' +
        '    !  →  %21\n'
      );
    } else if (err.message.includes('IP') || err.message.includes('whitelist') || err.message.includes('not allowed')) {
      console.error(
        '\n  Connection refused — your server\'s IP is not in the Atlas allowlist.\n' +
        '  Fix: Atlas → Network Access → Add IP Address → Allow Access from Anywhere (0.0.0.0/0)\n'
      );
    }

    console.error('  Run  node backend-express/test-db.js  to debug locally.\n');
    process.exit(1);
  }
}

module.exports = { connectDB };
