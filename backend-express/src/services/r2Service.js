/**
 * Object storage service — Backblaze B2 (native API).
 *
 * We started on Cloudflare R2 via @aws-sdk/client-s3, but R2's new cfat_*
 * unified tokens don't work with documented S3 derivation, and B2's
 * S3-compatible endpoint trips a checksum/signing bug in the modern AWS
 * SDK ("Credential access key has length 25, should be 32"). To avoid
 * the whole AWS-SDK rabbit hole, we use B2's **native** REST API instead.
 *
 * Native API is documented at https://www.backblaze.com/b2/docs/calling.html
 * and is a simple HTTP Basic auth → get-upload-url → upload flow.
 *
 * Env vars (legacy R2_ prefix kept so Render config doesn't churn):
 *   R2_ACCESS_KEY_ID     – B2 application key ID  (e.g. 005xxx...)
 *   R2_SECRET_ACCESS_KEY – B2 application key
 *   R2_BUCKET            – B2 bucket name (e.g. meyou-media)
 *   R2_PUBLIC_URL        – Public file URL prefix
 *                          (e.g. https://f005.backblazeb2.com/file/meyou-media)
 */

const axios = require('axios');
const crypto = require('crypto');

const configured = !!(
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY &&
  process.env.R2_BUCKET &&
  process.env.R2_PUBLIC_URL
);

const R2_PUBLIC_URL = configured
  ? process.env.R2_PUBLIC_URL.replace(/^<|>$/g, '').replace(/\/+$/, '')
  : '';

// Cache auth token; B2 tokens last 24h, refresh after 23h.
let authCache = null;
const AUTH_TTL_MS = 23 * 60 * 60 * 1000;

async function authorize() {
  if (authCache && authCache.expiresAt > Date.now()) return authCache;
  console.log('[b2] authorize() → b2_authorize_account');
  const credentials = Buffer.from(
    `${process.env.R2_ACCESS_KEY_ID}:${process.env.R2_SECRET_ACCESS_KEY}`,
  ).toString('base64');
  let data;
  try {
    // B2 v3 b2_authorize_account is a GET (axios.post would send 'null'
    // as body which B2 then tries to parse as JSON and fails with
    // "object should start with brace but found: ￿").
    const res = await axios.get(
      'https://api.backblazeb2.com/b2api/v3/b2_authorize_account',
      { headers: { Authorization: `Basic ${credentials}` } },
    );
    data = res.data;
  } catch (e) {
    console.error(
      '[b2] b2_authorize_account FAILED:',
      e?.response?.status,
      e?.response?.data || e?.message,
    );
    throw new Error(
      `b2_authorize_account ${e?.response?.status || ''}: ${
        e?.response?.data?.message || e?.message
      }`,
    );
  }

  // v3 returns apiInfo.storageApi.{apiUrl,downloadUrl,bucketId}.
  // Older clients sometimes saw the flat shape (apiUrl/downloadUrl at root).
  const storageApi = data.apiInfo?.storageApi ?? {};
  const apiUrl = storageApi.apiUrl || data.apiUrl;
  const downloadUrl = storageApi.downloadUrl || data.downloadUrl;
  let bucketId = storageApi.bucketId || null;

  if (!apiUrl) {
    console.error('[b2] no apiUrl in authorize response:', data);
    throw new Error('b2_authorize_account returned no apiUrl');
  }

  // If the key is not bucket-scoped, look up bucketId by name.
  if (!bucketId) {
    console.log('[b2] key is unscoped, looking up bucketId for', process.env.R2_BUCKET);
    try {
      const lookup = await axios.post(
        `${apiUrl}/b2api/v3/b2_list_buckets`,
        { accountId: data.accountId, bucketName: process.env.R2_BUCKET },
        { headers: { Authorization: data.authorizationToken } },
      );
      bucketId = lookup.data.buckets?.[0]?.bucketId;
    } catch (e) {
      console.error(
        '[b2] b2_list_buckets FAILED:',
        e?.response?.status,
        e?.response?.data || e?.message,
      );
      throw e;
    }
    if (!bucketId) {
      throw new Error(`B2 bucket not found: ${process.env.R2_BUCKET}`);
    }
  }

  authCache = {
    authToken: data.authorizationToken,
    apiUrl,
    downloadUrl,
    bucketId,
    expiresAt: Date.now() + AUTH_TTL_MS,
  };
  console.log('[b2] authorized — apiUrl:', apiUrl, 'bucketId:', bucketId);
  return authCache;
}

/**
 * Upload a buffer to B2.
 * @returns {Promise<string|null>} Public URL on success, null if not configured.
 */
async function uploadFile(buffer, key, contentType) {
  if (!configured) return null;
  const auth = await authorize();

  // 1) Get a one-shot upload URL
  let uploadUrl, uploadAuthToken;
  try {
    const urlRes = await axios.post(
      `${auth.apiUrl}/b2api/v3/b2_get_upload_url`,
      { bucketId: auth.bucketId },
      { headers: { Authorization: auth.authToken } },
    );
    uploadUrl = urlRes.data.uploadUrl;
    uploadAuthToken = urlRes.data.authorizationToken;
  } catch (e) {
    console.error(
      '[b2] b2_get_upload_url FAILED:',
      e?.response?.status,
      e?.response?.data || e?.message,
    );
    // Invalidate auth cache in case the token is stale
    authCache = null;
    throw new Error(
      `b2_get_upload_url ${e?.response?.status || ''}: ${
        e?.response?.data?.message || e?.message
      }`,
    );
  }

  // 2) SHA-1 of body (B2 requires this header)
  const sha1 = crypto.createHash('sha1').update(buffer).digest('hex');

  // 3) PUSH file — use transformRequest to keep Buffer raw (axios default
  // tries to serialize objects). Passing identity is the canonical fix.
  console.log('[b2] uploading', key, `(${buffer.length} bytes)`);
  try {
    await axios.post(uploadUrl, buffer, {
      headers: {
        Authorization: uploadAuthToken,
        'X-Bz-File-Name': encodeURIComponent(key),
        'Content-Type': contentType || 'image/jpeg',
        'Content-Length': buffer.length,
        'X-Bz-Content-Sha1': sha1,
      },
      transformRequest: [(d) => d],
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
  } catch (e) {
    console.error(
      '[b2] upload POST FAILED:',
      e?.response?.status,
      e?.response?.data || e?.message,
    );
    throw new Error(
      `b2 upload ${e?.response?.status || ''}: ${
        e?.response?.data?.message || e?.message
      }`,
    );
  }

  const publicUrl = `${R2_PUBLIC_URL}/${key}`;
  console.log('[b2] upload OK →', publicUrl);
  return publicUrl;
}

/**
 * Delete a file from B2 by key (object name within bucket).
 * Silently ignores errors.
 */
async function deleteFile(key) {
  if (!configured || !key) return;
  try {
    const auth = await authorize();
    // Look up the fileId for this name
    const listRes = await axios.post(
      `${auth.apiUrl}/b2api/v3/b2_list_file_versions`,
      { bucketId: auth.bucketId, startFileName: key, maxFileCount: 1 },
      { headers: { Authorization: auth.authToken } },
    );
    const file = (listRes.data.files || []).find((f) => f.fileName === key);
    if (!file) return;
    await axios.post(
      `${auth.apiUrl}/b2api/v3/b2_delete_file_version`,
      { fileName: key, fileId: file.fileId },
      { headers: { Authorization: auth.authToken } },
    );
  } catch (e) {
    console.warn('[b2] deleteFile failed:', e?.response?.data || e?.message);
  }
}

/**
 * Extract the object key from a full public URL.
 * Returns null if the URL is not from our bucket.
 */
function keyFromUrl(url) {
  if (!configured || !url) return null;
  const clean = url.replace(/[<>]/g, '');
  if (!clean.startsWith(R2_PUBLIC_URL)) return null;
  return clean.slice(R2_PUBLIC_URL.length).replace(/^\//, '');
}

module.exports = { configured, uploadFile, deleteFile, keyFromUrl };
