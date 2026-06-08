import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { Image } from 'react-native';
import { api } from './client';

function unwrap<T>(p: Promise<{ data: { data?: T } & T }>): Promise<T> {
  return p.then((r) => {
    const body = r.data as any;
    return (body?.data ?? body) as T;
  });
}

function getWidth(uri: string): Promise<number> {
  return new Promise((resolve) => {
    Image.getSize(uri, (w) => resolve(w), () => resolve(0));
  });
}

/**
 * Downscale + recompress an image before upload: cap the long edge at 1920px
 * (only when larger — never upscale), re-encode JPEG at 0.8. Keeps full-res
 * phone photos (often 4–8 MB) well under the server's multipart size limit and
 * saves the user's bandwidth + server CPU. Falls back to the original uri on
 * any failure so an upload is never blocked by optimization.
 *
 * Shared by both upload choke points (this file + api/privatePhotos.ts).
 */
export async function resizeForUpload(uri: string): Promise<string> {
  try {
    const w = await getWidth(uri);
    const actions = w > 1920 ? [{ resize: { width: 1920 } }] : [];
    const out = await ImageManipulator.manipulateAsync(uri, actions, {
      // 0.85 (was 0.8) — users reported visible blockiness on high-detail
      // photos. Pairs with the server sharp quality bump (80→90).
      compress: 0.85,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    return out.uri;
  } catch {
    return uri;
  }
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
  // Shrink before anything touches the network (prevents "File too large").
  uri = await resizeForUpload(uri);
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

export async function uploadProfilePhoto(
  uri: string,
  primary = true,
): Promise<PhotosUploadResult> {
  const fd = await fileFromUri(uri, 'photo');
  // primary=true (avatar picker) → backend prepends so the upload becomes
  // photos[0]/avatar. primary=false (adding a gallery photo) → append WITHOUT
  // promoting it to the avatar; the user picks the avatar explicitly.
  fd.append('primary', primary ? '1' : '0');
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

/** Reorder the photo gallery. photos[0] becomes the avatar — so "set as avatar"
 *  is just a reorder that moves the chosen url to the front. */
export const reorderPhotos = (photos: string[]) =>
  unwrap<{ photos: string[]; avatarUrl: string | null }>(
    api.patch('/users/photos/reorder', { photos }) as any,
  );
