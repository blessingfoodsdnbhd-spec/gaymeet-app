import * as FileSystem from 'expo-file-system';
import { api } from './client';

function unwrap<T>(p: Promise<{ data: { data?: T } & T }>): Promise<T> {
  return p.then((r) => {
    const body = r.data as any;
    return (body?.data ?? body) as T;
  });
}

/**
 * Copy any URI (content://, ph://, file://, etc.) into a predictable
 * cache-dir file:// path and return a FormData ready for multipart upload.
 *
 * Why we copy: ImagePicker on Android 13+ with the new Photo Picker can
 * return `content://media/...` URIs. RN's FormData reader is supposed to
 * resolve these via ContentResolver but in practice it fails silently on
 * a chunk of devices — the request either sends an empty body or hangs
 * past timeout with no actionable error. Copying via expo-file-system
 * (which uses ContentResolver itself) gives a known-readable file:// path
 * that every RN networking path handles. On iOS the copy is cheap and
 * the side-effect (predictable extension) helps the multipart filename.
 */
async function fileFromUri(uri: string, fieldName: string): Promise<FormData> {
  const rawExt = (uri.split('?')[0].split('.').pop() || '').toLowerCase();
  const safeExt = ['jpg', 'jpeg', 'png', 'heic', 'webp'].includes(rawExt)
    ? rawExt
    : 'jpg';
  const dest = `${FileSystem.cacheDirectory}upload-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${safeExt}`;
  await FileSystem.copyAsync({ from: uri, to: dest });

  const filename = dest.split('/').pop()!;
  const mime =
    safeExt === 'png'
      ? 'image/png'
      : safeExt === 'heic'
      ? 'image/heic'
      : safeExt === 'webp'
      ? 'image/webp'
      : 'image/jpeg';
  const fd = new FormData();
  fd.append(fieldName, { uri: dest, name: filename, type: mime } as any);
  return fd;
}

/**
 * Generic single-file upload to /api/upload. Returns the public URL.
 * Used for moments images and any other ad-hoc attachments.
 *
 * Timeout is bumped to 60s here (vs the global 30s) because:
 *   - photos can be a few MB over cellular,
 *   - the backend then re-uploads to Backblaze B2 (another network hop),
 *   - and a cold Render dyno adds ~20-50s on top of all that.
 */
const UPLOAD_TIMEOUT_MS = 60_000;

export async function uploadFile(uri: string): Promise<string> {
  const fd = await fileFromUri(uri, 'file');
  const res = await api.post('/upload', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    transformRequest: (data) => data, // axios would JSON.stringify FormData otherwise
    timeout: UPLOAD_TIMEOUT_MS,
  });
  const body = res.data as any;
  const payload = (body?.data ?? body) as { url: string };
  return payload.url;
}

/**
 * Profile photo upload — backend appends to user.photos[] and sets
 * photos[0] as avatarUrl. Returns the updated full lists.
 */
export interface PhotosUploadResult {
  url: string;
  avatarUrl: string | null;
  photos: string[];
}

export async function uploadProfilePhoto(uri: string): Promise<PhotosUploadResult> {
  const fd = await fileFromUri(uri, 'photo');
  // "Change avatar" UX → backend prepends instead of appending so the new
  // upload becomes photos[0] (the avatar). Without this the old photos[0]
  // sticks and the avatar visually never updates.
  fd.append('primary', '1');
  return unwrap<PhotosUploadResult>(
    api.post('/users/photos', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      transformRequest: (data) => data,
      timeout: UPLOAD_TIMEOUT_MS,
    }) as any,
  );
}

export const deleteProfilePhoto = (url: string) =>
  unwrap<{ photos: string[]; avatarUrl: string | null }>(
    api.delete('/users/photos', { data: { url } }) as any,
  );
