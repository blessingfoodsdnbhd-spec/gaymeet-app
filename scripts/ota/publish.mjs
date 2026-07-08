#!/usr/bin/env node
/**
 * Meyou OTA — build Expo Updates manifests from an `expo export` dist,
 * upload bundles+assets to R2, and register the manifests with the Worker.
 *
 * Called by scripts/publish-ota.sh (which runs `expo export` first).
 *
 * Usage:
 *   node scripts/ota/publish.mjs \
 *     --dist app-rn/dist --channel production --runtime 1.0.0 \
 *     --host https://updates.meyou.uk --bucket meyou-ota-bundles --token <admin>
 *
 * The manifest `id` is derived deterministically from the update contents, so
 * re-publishing an unchanged bundle yields the same id and clients treat it as
 * "no new update" (idempotent).
 */
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

// ── args ──────────────────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith('--')) acc.push([cur.slice(2), arr[i + 1]]);
    return acc;
  }, []),
);
const DIST = args.dist || 'app-rn/dist';
const CHANNEL = args.channel || 'production';
const RUNTIME = args.runtime || '1.0.0';
const HOST = (args.host || 'https://updates.meyou.uk').replace(/\/$/, '');
const BUCKET = args.bucket || 'meyou-ota-bundles';
const TOKEN = args.token || process.env.OTA_ADMIN_TOKEN;
const REMOTE = 'local' in args ? '--local' : '--remote'; // R2 target
if (!TOKEN) fail('missing --token / OTA_ADMIN_TOKEN');

// ── mime (assets) ─────────────────────────────────────────────────────────────
const MIME = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', svg: 'image/svg+xml', ttf: 'font/ttf', otf: 'font/otf',
  woff: 'font/woff', woff2: 'font/woff2', json: 'application/json',
  mp3: 'audio/mpeg', wav: 'audio/wav', mp4: 'video/mp4', db: 'application/octet-stream',
};
const mimeFor = (ext) => MIME[String(ext || '').toLowerCase()] || 'application/octet-stream';

// url-safe base64 of the SHA-256 — the integrity `hash` expo-updates verifies.
function sha256base64url(buf) {
  return createHash('sha256').update(buf).digest('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
// md5 hex — the content-addressed `key` (also the R2 object name).
const md5hex = (buf) => createHash('md5').update(buf).digest('hex');

// Deterministic UUIDv4-shaped id from bytes (first 16 bytes of a sha256).
function idFromContent(seed) {
  const b = createHash('sha256').update(seed).digest();
  const h = b.subarray(0, 16);
  const hex = Buffer.from(h).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function fail(msg) { console.error(`\n  ✗ OTA publish: ${msg}\n`); process.exit(1); }

// Upload a file to R2. Keys are content-addressed (md5 of the bytes), so
// re-putting an unchanged blob is a harmless no-op overwrite.
function uploadBlob(r2Key, filePath, contentType) {
  execFileSync('wrangler',
    ['r2', 'object', 'put', `${BUCKET}/${r2Key}`, '--file', filePath, '--content-type', contentType, REMOTE],
    { stdio: 'ignore' });
  return 'uploaded';
}

// ── main ──────────────────────────────────────────────────────────────────────
const metaPath = join(DIST, 'metadata.json');
if (!existsSync(metaPath)) fail(`no metadata.json at ${metaPath} — did \`expo export\` run?`);
const metadata = JSON.parse(readFileSync(metaPath, 'utf8'));
const fm = metadata.fileMetadata || {};
const platforms = Object.keys(fm).filter((p) => p === 'ios' || p === 'android');
if (!platforms.length) fail('metadata.json has no ios/android fileMetadata');

const createdAt = new Date().toISOString();

for (const platform of platforms) {
  const entry = fm[platform];
  // launch asset (the JS bundle)
  const bundleRel = entry.bundle;
  const bundleBuf = readFileSync(join(DIST, bundleRel));
  const bundleKey = md5hex(bundleBuf);
  const bundleHash = sha256base64url(bundleBuf);
  const bu = uploadBlob(`bundles/${bundleKey}`, join(DIST, bundleRel), 'application/javascript');

  const launchAsset = {
    hash: bundleHash,
    key: bundleKey,
    contentType: 'application/javascript',
    fileExtension: '.bundle',
    url: `${HOST}/bundles/${bundleKey}`,
  };

  // assets
  const assets = [];
  for (const a of entry.assets || []) {
    const buf = readFileSync(join(DIST, a.path));
    const key = md5hex(buf);
    assets.push({
      hash: sha256base64url(buf),
      key,
      contentType: mimeFor(a.ext),
      fileExtension: `.${a.ext}`,
      url: `${HOST}/assets/${key}`,
    });
    uploadBlob(`assets/${key}`, join(DIST, a.path), mimeFor(a.ext));
  }

  const seed = platform + '|' + bundleHash + '|' + assets.map((x) => x.hash).sort().join(',');
  const id = idFromContent(seed);

  const manifest = {
    id,
    createdAt,
    runtimeVersion: RUNTIME,
    launchAsset,
    assets,
    metadata: {},
    extra: { channel: CHANNEL, expoClient: { name: 'Meyou' } },
  };

  // register with the Worker (writes latest + snapshot + history)
  const res = execFileSync('curl', [
    '-sS', '-X', 'POST', `${HOST}/admin/publish`,
    '-H', `x-ota-admin-token: ${TOKEN}`,
    '-H', 'content-type: application/json',
    '-d', JSON.stringify({ channel: CHANNEL, platform, runtimeVersion: RUNTIME, manifest }),
  ]).toString();

  let ok = false;
  try { ok = JSON.parse(res).ok === true; } catch { /* noop */ }
  console.log(
    `  ${ok ? '✓' : '✗'} ${platform}  rtv=${RUNTIME}  channel=${CHANNEL}  id=${id}` +
    `  (bundle ${bu}, ${assets.length} assets)`,
  );
  if (!ok) fail(`Worker rejected ${platform} manifest: ${res}`);
}

console.log(`\n  ✅ OTA published to ${HOST}  (channel: ${CHANNEL})`);
console.log('  Users get it on their next cold start.\n');
