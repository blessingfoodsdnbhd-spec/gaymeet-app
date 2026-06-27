// One-off: reset hafiz@example.com to non-Premium so the App Review reviewer
// sees the full IAP purchase flow. Safe to re-run (idempotent).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const q = { email: { $regex: '^hafiz@example.com$', $options: 'i' } };
  const upd = await db
    .collection('users')
    .updateOne(q, { $set: { isPremium: false, premiumExpiresAt: null } });
  console.log('matched:', upd.matchedCount, 'modified:', upd.modifiedCount);
  const doc = await db
    .collection('users')
    .findOne(q, { projection: { email: 1, isPremium: 1, premiumExpiresAt: 1, nickname: 1 } });
  console.log('AFTER:', JSON.stringify(doc, null, 2));
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
