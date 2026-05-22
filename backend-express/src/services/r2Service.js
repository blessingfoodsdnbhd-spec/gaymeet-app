/**
 * S3-compatible object storage service.
 *
 * Works with any S3-compatible provider (Cloudflare R2, Backblaze B2,
 * AWS S3, etc.). When the required env vars are missing, `configured`
 * is false and every upload call returns null — callers must fall back
 * to local disk.
 *
 * Required env vars:
 *   R2_ACCESS_KEY_ID    – Access key
 *   R2_SECRET_ACCESS_KEY– Secret key
 *   R2_BUCKET           – Bucket name
 *   R2_PUBLIC_URL       – Public base URL for objects in bucket
 *
 * Endpoint (one of):
 *   R2_ENDPOINT         – Full S3 endpoint URL (preferred; provider-agnostic)
 *                         e.g. https://s3.us-east-005.backblazeb2.com
 *   R2_ACCOUNT_ID       – Cloudflare account ID (fallback; R2-only)
 *                         Will build https://<id>.r2.cloudflarestorage.com
 *
 * Optional:
 *   R2_REGION           – SigV4 region. Defaults to 'auto' (good for R2)
 *                         For B2 must match bucket region (e.g. 'us-east-005')
 */

const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} = require('@aws-sdk/client-s3');

const hasEndpoint = !!(process.env.R2_ENDPOINT || process.env.R2_ACCOUNT_ID);

const configured = !!(
  hasEndpoint &&
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

const endpoint = process.env.R2_ENDPOINT
  ? process.env.R2_ENDPOINT.replace(/\/+$/, '')
  : `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

let s3 = null;
if (configured) {
  s3 = new S3Client({
    region: process.env.R2_REGION || 'auto',
    endpoint,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
    // B2 / R2 / other S3-compatibles do not implement AWS' newer
    // flexible-checksum + auto-validated PUT checksums. Recent
    // @aws-sdk/client-s3 (>=3.730) trips a "Credential access key has
    // length N, should be 32" client-side validation when those headers
    // are added with a non-32-char access key. Forcing both knobs to
    // WHEN_REQUIRED disables the auto-checksum that triggers it.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
    // Use path-style URLs (bucket in path, not subdomain). B2 supports
    // both, but path-style avoids DNS edge cases.
    forcePathStyle: true,
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
