/**
 * Backfill legacy MomentComment.likes → reactions['👍'].
 *
 * Before YYYYY, per-comment likes lived in the `likes` array. The new
 * FB-style reactions store emoji → userId[] in `reactions`. This copies every
 * non-empty `likes` into the 👍 reaction bucket so existing likes survive the
 * upgrade. Idempotent: skips comments that already have any reactions.
 *
 * Usage:
 *   node scripts/backfill-comment-reactions.js --dry   # preview, no writes
 *   node scripts/backfill-comment-reactions.js         # live
 */
require('dotenv').config();
const mongoose = require('mongoose');
const MomentComment = require('../src/models/MomentComment');

const DRY = process.argv.includes('--dry');

async function run() {
  console.log(`\n=== backfill-comment-reactions ${DRY ? '(DRY RUN)' : '(LIVE)'} ===`);
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });

  // Comments with at least one like and no reactions yet.
  const cursor = MomentComment.find({ 'likes.0': { $exists: true } }).cursor();
  let scanned = 0;
  let migrated = 0;
  let skipped = 0;

  for (let c = await cursor.next(); c != null; c = await cursor.next()) {
    scanned++;
    const hasReactions = c.reactions && c.reactions.size > 0;
    if (hasReactions) {
      skipped++;
      continue;
    }
    migrated++;
    if (!DRY) {
      c.reactions.set('👍', c.likes);
      c.markModified('reactions');
      await c.save();
    }
  }

  console.log('SUMMARY:', JSON.stringify({ scanned, migrated, skipped, dry: DRY }, null, 2));
  await mongoose.disconnect();
}

run().catch(async (e) => {
  console.error('ERROR:', e);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
