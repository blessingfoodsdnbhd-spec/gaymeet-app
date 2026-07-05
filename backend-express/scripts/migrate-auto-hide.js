/**
 * Migration for the auto-hide-at-3-reports feature (feat/auto-hide-reports).
 *
 * Idempotent. Safe to run multiple times. Two jobs:
 *   1. Backfill reportCount/hidden defaults onto existing moments / vote events /
 *      vote entries. (Not strictly required — feed filters use `hidden: {$ne:true}`
 *      so absent fields already read as visible — but it makes the data explicit.)
 *   2. Ensure the ContentReport unique index (reporterId, targetType, targetId)
 *      exists. Mongoose autoIndex normally creates it on boot; this is a safety
 *      net for environments where autoIndex is disabled.
 *
 * Usage (from backend-express/, with MONGODB_URI in env or .env):
 *   node scripts/migrate-auto-hide.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15_000 });
  console.log('connected:', mongoose.connection.host, 'db:', mongoose.connection.name);
  const db = mongoose.connection.db;

  const defaults = { reportCount: 0, hidden: false };
  for (const coll of ['moments', 'voteevents', 'voteentries']) {
    const r = await db
      .collection(coll)
      .updateMany({ reportCount: { $exists: false } }, { $set: defaults });
    console.log(`backfill ${coll}: matched=${r.matchedCount} modified=${r.modifiedCount}`);
  }

  // Unique index on ContentReport — enforces the "unique reporter" count.
  try {
    await db
      .collection('contentreports')
      .createIndex({ reporterId: 1, targetType: 1, targetId: 1 }, { unique: true });
    console.log('contentreports unique index ok');
  } catch (e) {
    console.error('index create warning:', e.message);
  }

  const idx = await db.collection('contentreports').indexes().catch(() => []);
  console.log('contentreports indexes:', JSON.stringify(idx.map((i) => i.name)));

  await mongoose.disconnect();
  console.log('done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
