// Removes duplicate messages: same matchId + content + type within 2 seconds of each other.
// Keeps the earliest message (lowest createdAt). Safe to re-run.
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Message = require('../src/models/Message');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  // Group messages by matchId + content + type, sorted oldest-first.
  const pipeline = [
    { $sort: { matchId: 1, content: 1, type: 1, createdAt: 1 } },
    {
      $group: {
        _id: { matchId: '$matchId', content: '$content', type: '$type' },
        ids: { $push: '$_id' },
        times: { $push: '$createdAt' },
      },
    },
    { $match: { 'ids.1': { $exists: true } } }, // groups with > 1 message
  ];

  const groups = await Message.aggregate(pipeline);
  console.log(`Found ${groups.length} candidate groups`);

  let deleted = 0;

  for (const g of groups) {
    // Pair each id with its timestamp; sort by time ascending
    const pairs = g.ids.map((id, i) => ({ id, t: new Date(g.times[i]).getTime() }));
    pairs.sort((a, b) => a.t - b.t);

    const keep = pairs[0].id; // oldest
    const toDelete = [];

    for (let i = 1; i < pairs.length; i++) {
      // Only remove if within 2 seconds of the kept message
      if (pairs[i].t - pairs[0].t <= 2000) {
        toDelete.push(pairs[i].id);
      }
    }

    if (toDelete.length > 0) {
      await Message.deleteMany({ _id: { $in: toDelete } });
      deleted += toDelete.length;
      console.log(`  Group [${g._id.matchId}] "${g._id.content.slice(0, 30)}" — deleted ${toDelete.length}`);
    }
  }

  console.log(`\nDone. Deleted ${deleted} duplicate message(s).`);
  await mongoose.disconnect();
}

run().catch((e) => { console.error(e); process.exit(1); });
