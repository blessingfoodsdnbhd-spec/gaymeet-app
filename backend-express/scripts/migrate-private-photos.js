/**
 * One-shot migration: move existing private photos out of the PUBLIC bucket
 * into the PRIVATE bucket, rewrite the DB references to `b2priv://<key>`
 * sentinels, and delete the public copies.
 *
 * Why: before C-1, private photos were uploaded to the public bucket at
 * guessable URLs, so the access gate was bypassable. This relocates them so
 * they're only reachable via short-lived signed URLs.
 *
 * Usage:
 *   node scripts/migrate-private-photos.js --dry-run   # report only, no writes
 *   node scripts/migrate-private-photos.js             # perform migration
 *
 * Safe to re-run (idempotent): refs already on `b2priv://` are skipped.
 * Requires: B2_PRIVATE_BUCKET_NAME + B2_PRIVATE_BUCKET_ID + the R2_* (B2)
 * envs + MONGODB_URI. Exits early with a clear message if the private bucket
 * isn't configured.
 */

const mongoose = require('mongoose');
const axios = require('axios');
const r2 = require('../src/services/r2Service');

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  if (!r2.privateConfigured) {
    console.error(
      'Private bucket not configured (B2_PRIVATE_BUCKET_NAME / ' +
        'B2_PRIVATE_BUCKET_ID). Nothing to migrate. Set the envs first.'
    );
    process.exit(1);
  }
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI not set.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const User = require('../src/models/User');

  // Only users that actually have private photos.
  const users = await User.find(
    { privatePhotos: { $exists: true, $not: { $size: 0 } } },
    { privatePhotos: 1 }
  );

  console.log(
    `${DRY_RUN ? '[DRY RUN] ' : ''}${users.length} user(s) with private photos.`
  );

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const u of users) {
    const next = [];
    let changed = false;

    for (const ref of u.privatePhotos) {
      // Already migrated.
      if (r2.isPrivateRef(ref)) {
        next.push(ref);
        skipped += 1;
        continue;
      }

      const key = r2.keyFromUrl(ref);
      if (!key) {
        // Not a recognizable public-bucket URL (e.g. old local-disk dev URL).
        // Leave it as-is — can't relocate what we can't fetch from the bucket.
        next.push(ref);
        skipped += 1;
        continue;
      }

      if (DRY_RUN) {
        console.log(`  would migrate: ${ref}`);
        next.push(`${r2.PRIVATE_KEY_PREFIX}${key}`);
        migrated += 1;
        changed = true;
        continue;
      }

      try {
        // Download the public object, re-upload to the private bucket, then
        // delete the public copy.
        const resp = await axios.get(ref, { responseType: 'arraybuffer' });
        const buf = Buffer.from(resp.data);
        const contentType = resp.headers['content-type'] || 'image/jpeg';
        const newRef = await r2.uploadPrivate(buf, key, contentType);
        if (!newRef) throw new Error('uploadPrivate returned null');
        next.push(newRef);
        // Delete the public copy (best-effort).
        await r2.deleteFile(key);
        migrated += 1;
        changed = true;
        console.log(`  migrated: ${ref} → ${newRef}`);
      } catch (e) {
        failed += 1;
        next.push(ref); // keep original on failure
        console.warn(`  FAILED ${ref}: ${e.message}`);
      }
    }

    if (changed && !DRY_RUN) {
      u.privatePhotos = next;
      await u.save();
    }
  }

  console.log(
    `\nDone. migrated=${migrated} skipped=${skipped} failed=${failed}` +
      (DRY_RUN ? ' (dry run — no writes)' : '')
  );
  await mongoose.disconnect();
  process.exit(failed > 0 ? 2 : 0);
}

main().catch((e) => {
  console.error('Migration crashed:', e);
  process.exit(1);
});
