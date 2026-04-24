// Grant a VIP tier to a user by email, for N years.
//
// Usage:
//   MONGODB_URI='<uri>' node scripts/grant-vip.js <email> <vipLevel> <years>
//
// Example — make tyf91andrew@icloud.com VIP level 3 (rainbow) for 10 years:
//   MONGODB_URI='mongodb+srv://...' node scripts/grant-vip.js tyf91andrew@icloud.com 3 10
//
// This sets: vipLevel, vipExpiresAt, isPremium=true, premiumExpiresAt.
// Safe to re-run; will overwrite previous VIP settings.

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../src/models/User');

async function run() {
  const [, , emailArg, levelArg, yearsArg] = process.argv;

  if (!emailArg || !levelArg || !yearsArg) {
    console.error('Usage: node scripts/grant-vip.js <email> <vipLevel:1-3> <years>');
    process.exit(1);
  }

  const email = emailArg.toLowerCase().trim();
  const vipLevel = parseInt(levelArg, 10);
  const years = parseInt(yearsArg, 10);

  if (!(vipLevel >= 1 && vipLevel <= 3)) {
    console.error('vipLevel must be 1, 2, or 3');
    process.exit(1);
  }
  if (!(years > 0 && years <= 100)) {
    console.error('years must be between 1 and 100');
    process.exit(1);
  }
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI not set. Run with: MONGODB_URI="..." node scripts/grant-vip.js ...');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + years);

  // Case-insensitive email lookup
  const user = await User.findOne({ email: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });

  if (!user) {
    console.error(`No user found with email: ${email}`);
    // Show similar emails to help debug typos
    const similar = await User.find({ email: new RegExp(email.split('@')[0], 'i') })
      .select('email _id')
      .limit(5);
    if (similar.length) {
      console.error('Similar emails in DB:');
      similar.forEach((u) => console.error(`  - ${u.email} (id: ${u._id})`));
    }
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`Found user: ${user.email} (id: ${user._id})`);
  console.log(`Current: vipLevel=${user.vipLevel || 0}, isPremium=${user.isPremium}, vipExpiresAt=${user.vipExpiresAt}`);

  user.vipLevel = vipLevel;
  user.vipExpiresAt = expiresAt;
  user.isPremium = true;
  user.premiumExpiresAt = expiresAt;

  await user.save();

  console.log('---');
  console.log(`✅ Granted VIP level ${vipLevel} until ${expiresAt.toISOString()}`);
  console.log(`Updated: vipLevel=${user.vipLevel}, isPremium=${user.isPremium}, vipExpiresAt=${user.vipExpiresAt}`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
