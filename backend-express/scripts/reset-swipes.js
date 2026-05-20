// One-off admin tool: wipe every Swipe a given user has made so the same
// candidates re-enter their Discover deck. Matches are left alone — existing
// chats stay intact.
//
// Usage:
//   EMAIL=foo@example.com node scripts/reset-swipes.js
//
// Or by user id:
//   USER_ID=507f1f77bcf86cd799439011 node scripts/reset-swipes.js
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Swipe = require('../src/models/Swipe');

async function run() {
  const email = process.env.EMAIL;
  const userId = process.env.USER_ID;
  if (!email && !userId) {
    console.error('Usage: EMAIL=foo@example.com node scripts/reset-swipes.js');
    console.error('   or: USER_ID=507f… node scripts/reset-swipes.js');
    process.exit(1);
  }

  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI not set (put it in backend-express/.env)');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  let user;
  if (userId) {
    user = await User.findById(userId);
  } else {
    user = await User.findOne({ email: email.toLowerCase().trim() });
  }
  if (!user) {
    console.error('User not found.');
    process.exit(2);
  }
  console.log(`User: ${user.nickname} <${user.email}> (${user._id})`);

  const before = await Swipe.countDocuments({ fromUser: user._id });
  const { deletedCount } = await Swipe.deleteMany({ fromUser: user._id });
  console.log(`Deleted ${deletedCount} of ${before} swipe records.`);

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
