/**
 * Cloudflare R2 storage service (S3-compatible).
 *
 * When R2_* env vars are absent, `configured` is false and every
 * upload call returns null — callers must fall back to local disk.
 *
 * Required env vars:
 *   R2_ACCOUNT_ID       – Cloudflare account ID (32-char hex)
 *   R2_ACCESS_KEY_ID    – R2 API token access key
 *   R2_SECRET_ACCESS_KEY– R2 API token secret
 *   R2_BUCKET           – Bucket name (e.g. meetupnearby-media)
 *   R2_PUBLIC_URL       – Public URL for bucket
 *                         e.g. https://pub-<hash>.r2.dev  OR  https://media.yourdomain.com
 */

const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} = require('@aws-sdk/client-s3');

const configured = !!(
  process.env.R2_ACCOUNT_ID &&
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY &&
  process.env.R2_BUCKET &&
  process.env.R2_PUBLIC_URL
);

// Strip accidental angle brackets from R2_PUBLIC_URL (e.g. <https://...>)
// and trailing slashes so we always build clean URLs.
const R2_PUBLIC_URL = configured
  ? process.env.R2_PUBLIC_URL.replace(/^<|>$/g, '').replace(/\/+$/, '')
  : '';

let s3 = null;
if (configured) {
  s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}

/**
 * Upload a buffer to R2.
 * @returns {Promise<string|null>} Public URL on success, null if not configured.
 */
async function uploadFile(buffer, key, contentType) {
  if (!configured) return null;
  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType || 'image/jpeg',
    })
  );
  return `${R2_PUBLIC_URL}/${key}`;
}

/**
 * Delete a file from R2 by key (not full URL).
 * Silently ignores errors.
 */
async function deleteFile(key) {
  if (!configured || !key) return;
  try {
    await s3.send(
      new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key })
    );
  } catch (_) {}
}

/**
 * Extract the R2 object key from a full public URL.
 * Returns null if the URL is not from R2.
 */
function keyFromUrl(url) {
  if (!configured || !url) return null;
  // Strip any accidental angle brackets from the stored URL before matching
  const clean = url.replace(/[<>]/g, '');
  if (!clean.startsWith(R2_PUBLIC_URL)) return null;
  return clean.slice(R2_PUBLIC_URL.length).replace(/^\//, '');
}

module.exports = { configured, uploadFile, deleteFile, keyFromUrl };
