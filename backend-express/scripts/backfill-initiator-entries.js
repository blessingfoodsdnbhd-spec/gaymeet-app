/**
 * backfill-initiator-entries.js — make every existing VoteEvent's creator a
 * contestant (idempotent).
 *
 *   node scripts/backfill-initiator-entries.js --dry   # read-only: report plan
 *   node scripts/backfill-initiator-entries.js         # perform inserts
 *
 * PR CCCCC turned the contest initiator into an auto-entry (rank #1). This
 * backfills that invariant for events created before the change: for any event
 * with NO VoteEntry from its creator, it inserts one using the event's first
 * cover photo, and bumps entryCount.
 *
 * Idempotent & safe to re-run:
 *   - skips events where the creator already has an entry,
 *   - skips events with no cover photo (nothing to seed the entry with),
 *   - only ever INSERTs entries / $inc entryCount; never deletes or edits votes.
 */
require('dotenv').config();
const mongoose = require('mongoose');

const DRY = process.argv.includes('--dry');

const VoteEvent = require('../src/models/VoteEvent');
const VoteEntry = require('../src/models/VoteEntry');

async function run() {
  console.log(`\n=== backfill initiator entries ${DRY ? '(DRY RUN — no writes)' : '(LIVE)'} ===`);
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  console.log('Connected to MongoDB ✓\n');

  const events = await VoteEvent.find({}).lean();
  console.log(`Scanning ${events.length} event(s)…\n`);

  let created = 0;
  let skippedHasEntry = 0;
  let skippedNoCover = 0;

  for (const ev of events) {
    const has = await VoteEntry.exists({ eventId: ev._id, submitterId: ev.creatorId });
    if (has) {
      skippedHasEntry++;
      continue;
    }
    const cover = Array.isArray(ev.coverPhotos) ? ev.coverPhotos[0] : null;
    if (!cover) {
      skippedNoCover++;
      console.log(`  SKIP (no cover): ${ev._id} "${ev.title}"`);
      continue;
    }
    console.log(`  ${DRY ? 'WOULD ADD' : 'ADD'} creator entry: ${ev._id} "${ev.title}"`);
    if (!DRY) {
      await VoteEntry.create({
        eventId: ev._id,
        submitterId: ev.creatorId,
        photoUrl: cover,
        caption: '',
      });
      await VoteEvent.updateOne({ _id: ev._id }, { $inc: { entryCount: 1 } });
    }
    created++;
  }

  console.log('\nSUMMARY:', JSON.stringify({
    events: events.length,
    created,
    skippedHasEntry,
    skippedNoCover,
  }, null, 2));

  await mongoose.disconnect();
  console.log('\nDisconnected ✓');
}

run().catch(async (e) => {
  console.error('BACKFILL ERROR:', e);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
