import { api } from './client';

function unwrap<T>(p: Promise<{ data: { data?: T } & T }>): Promise<T> {
  return p.then((r) => {
    const body = r.data as any;
    return (body?.data ?? body) as T;
  });
}

/**
 * Build a FormData entry from an Expo image-picker URI. RN FormData accepts
 * a `{ uri, name, type }` triple as the third positional FormData arg; this
 * is not standard DOM behavior but is the documented RN pattern.
 */
function fileFromUri(uri: string, fieldName: string) {
  const filename = uri.split('/').pop() || `upload-${Date.now()}.jpg`;
  const ext = (filename.split('.').pop() || 'jpg').toLowerCase();
  const mime =
    ext === 'png' ? 'image/png' : ext === 'heic' ? 'image/heic' : 'image/jpeg';
  const fd = new FormData();
  // RN's FormData accepts this shape — cast to any to satisfy lib.dom.
  fd.append(fieldName, { uri, name: filename, type: mime } as any);
  return fd;
}

/**
 * Generic single-file upload to /api/upload. Returns the public URL.
 * Used for moments images and any other ad-hoc attachments.
 */
export async function uploadFile(uri: string): Promise<string> {
  const fd = fileFromUri(uri, 'file');
  const res = await api.post('/upload', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    transformRequest: (data) => data, // axios would JSON.stringify FormData otherwise
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
  const fd = fileFromUri(uri, 'photo');
  // "Change avatar" UX → backend prepends instead of appending so the new
  // upload becomes photos[0] (the avatar). Without this the old photos[0]
  // sticks and the avatar visually never updates.
  fd.append('primary', '1');
  return unwrap<PhotosUploadResult>(
    api.post('/users/photos', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      transformRequest: (data) => data,
    }) as any,
  );
}

export const deleteProfilePhoto = (url: string) =>
  unwrap<{ photos: string[]; avatarUrl: string | null }>(
    api.delete('/users/photos', { data: { url } }) as any,
  );
