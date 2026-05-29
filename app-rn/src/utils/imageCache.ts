import * as FileSystem from 'expo-file-system';

/**
 * Per-message image cache. Chat image messages get downloaded into the
 * app's cache directory on first render so re-opening the thread (or
 * scrolling back to the message) is instant + offline-tolerant. Keyed by
 * the server message id; absolute paths are returned so callers can plug
 * them straight into ExpoImage.source.
 *
 * The directory lives under FileSystem.cacheDirectory — the OS can evict
 * it under storage pressure, which is fine: the original B2 URL is still
 * on the Message row and we'll re-download on next view.
 */

// Bumped chat-images → chat-images-v2 alongside the backend fix that
// adds id to GET /messages responses. The old dir may contain
// `undefined.jpg` polluted by the _id-vs-id mismatch — orphaning it
// here means every client loads against a clean directory after this
// build, and the OS will GC the old one under cache pressure.
const CACHE_DIR = `${FileSystem.cacheDirectory}chat-images-v2/`;

let ensured = false;
async function ensureDir(): Promise<void> {
  if (ensured) return;
  try {
    const info = await FileSystem.getInfoAsync(CACHE_DIR);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
    }
    ensured = true;
  } catch {
    // Make-directory failures should be rare (OOD / permissions); next
    // call will retry.
  }
}

/** Cache path for a given message id. Caller does not need to ensureDir
 *  for read-only operations. */
export function cachePathFor(msgId: string, ext = 'jpg'): string {
  return `${CACHE_DIR}${msgId}.${ext}`;
}

/** Returns the cached file URI if it exists locally, null otherwise. */
export async function getCachedImage(
  msgId: string,
  ext = 'jpg',
): Promise<string | null> {
  try {
    const path = cachePathFor(msgId, ext);
    const info = await FileSystem.getInfoAsync(path);
    return info.exists ? path : null;
  } catch {
    return null;
  }
}

/**
 * Background download — returns the cached path on success, null on
 * failure (network, 404, B2 hiccup). Safe to call repeatedly; if the
 * file already exists we short-circuit instead of re-downloading.
 */
export async function downloadAndCache(
  msgId: string,
  url: string,
  ext = 'jpg',
): Promise<string | null> {
  if (!url) return null;
  try {
    await ensureDir();
    const path = cachePathFor(msgId, ext);
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists) return path;
    const result = await FileSystem.downloadAsync(url, path);
    if (result.status >= 200 && result.status < 300) return path;
    // Non-2xx → drop the partial file so the next attempt re-downloads
    try {
      await FileSystem.deleteAsync(path, { idempotent: true });
    } catch {}
    return null;
  } catch {
    return null;
  }
}

/** Best-effort local delete. Used when a message is deleted/unsent so
 *  the cache doesn't keep a dangling copy. */
export async function deleteCachedImage(
  msgId: string,
  ext = 'jpg',
): Promise<void> {
  try {
    const path = cachePathFor(msgId, ext);
    await FileSystem.deleteAsync(path, { idempotent: true });
  } catch {
    // already gone or permission edge — fine
  }
}
