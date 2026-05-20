// Grant Premium subscription to a user — Meyou 密友 v2 single-SKU model.
//
// Usage:
//   EMAIL=foo@example.com MONTHS=1   node scripts/grant-premium.js   # 1-month
//   EMAIL=foo@example.com MONTHS=12  node scripts/grant-premium.js   # annual
//   USER_ID=507f… MONTHS=1 node scripts/grant-premium.js
//
// Sets isPremium = true, premiumExpiresAt = now + MONTHS. Safe to re-run.
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../src/models/User');

async function run() {
  const email = process.env.EMAIL;
  const userId = process.env.USER_ID;
  const months = parseInt(process.env.MONTHS ?? '1', 10);

  if (!email && !userId) {
    console.error('Usage: EMAIL=foo@example.com MONTHS=1 node scripts/grant-premium.js');
    process.exit(1);
  }
  if (!(months > 0 && months <= 120)) {
    console.error('MONTHS must be 1–120');
    process.exit(1);
  }
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const query = userId ? { _id: userId } : { email: email.toLowerCase().trim() };
  const user = await User.findOne(query);
  if (!user) {
    console.error('User not found.');
    process.exit(2);
  }

  // Extend from now or from the existing expiry, whichever is later.
  const base = user.premiumExpiresAt && new Date(user.premiumExpiresAt) > new Date()
    ? new Date(user.premiumExpiresAt)
    : new Date();
  const expiresAt = new Date(base);
  expiresAt.setMonth(expiresAt.getMonth() + months);

  await User.findByIdAndUpdate(user._id, {
    isPremium: true,
    premiumExpiresAt: expiresAt,
  });

  console.log(
    `Granted Premium to ${user.nickname} <${user.email}> until ${expiresAt.toISOString()}`,
  );
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
