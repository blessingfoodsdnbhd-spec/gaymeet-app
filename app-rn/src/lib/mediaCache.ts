// Media cache management (Phase 10, CACHE1). A 7-day LRU over a dedicated cache
// dir plus controls to clear the expo-image disk cache (where remote chat/profile
// images live). All best-effort; never throws.
import * as FileSystem from 'expo-file-system';
import { Image as ExpoImage } from 'expo-image';

export const MEDIA_TTL_DAYS_DEFAULT = 7;

const MEDIA_DIR = `${FileSystem.cacheDirectory ?? ''}meyou-media/`;

async function ensureDir() {
  try {
    const info = await FileSystem.getInfoAsync(MEDIA_DIR);
    if (!info.exists) await FileSystem.makeDirectoryAsync(MEDIA_DIR, { intermediates: true });
  } catch {
    // ignore
  }
}

/** Total bytes in the managed media dir. */
export async function getMediaCacheSize(): Promise<number> {
  try {
    const info = await FileSystem.getInfoAsync(MEDIA_DIR);
    if (!info.exists) return 0;
    const names = await FileSystem.readDirectoryAsync(MEDIA_DIR);
    let total = 0;
    for (const name of names) {
      const fi = await FileSystem.getInfoAsync(MEDIA_DIR + name, { size: true });
      if (fi.exists && typeof fi.size === 'number') total += fi.size;
    }
    return total;
  } catch {
    return 0;
  }
}

/** Evict managed media files older than the TTL (LRU by modification time). */
export async function evictOldMedia(maxAgeDays = MEDIA_TTL_DAYS_DEFAULT): Promise<number> {
  try {
    const info = await FileSystem.getInfoAsync(MEDIA_DIR);
    if (!info.exists) return 0;
    const names = await FileSystem.readDirectoryAsync(MEDIA_DIR);
    const cutoffSec = (Date.now() - maxAgeDays * 24 * 60 * 60 * 1000) / 1000;
    let removed = 0;
    for (const name of names) {
      const fi = await FileSystem.getInfoAsync(MEDIA_DIR + name);
      // modificationTime is in seconds since epoch.
      if (fi.exists && typeof fi.modificationTime === 'number' && fi.modificationTime < cutoffSec) {
        await FileSystem.deleteAsync(MEDIA_DIR + name, { idempotent: true });
        removed++;
      }
    }
    return removed;
  } catch {
    return 0;
  }
}

/** Clear the managed media dir AND the expo-image disk + memory caches. */
export async function clearMediaCache(): Promise<void> {
  try {
    await FileSystem.deleteAsync(MEDIA_DIR, { idempotent: true });
    await ensureDir();
  } catch {
    // ignore
  }
  try {
    await ExpoImage.clearDiskCache();
    await ExpoImage.clearMemoryCache();
  } catch {
    // ignore
  }
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  const units = ['KB', 'MB', 'GB'];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(1)} ${units[i]}`;
}
