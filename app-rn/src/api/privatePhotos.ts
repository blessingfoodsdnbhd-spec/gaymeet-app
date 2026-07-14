import * as FileSystem from 'expo-file-system';
import { api } from './client';
import { resizeForUpload } from './upload';

function unwrap<T>(p: Promise<{ data: { data?: T } & T }>): Promise<T> {
  return p.then((r) => {
    const body = r.data as any;
    return (body?.data ?? body) as T;
  });
}

/**
 * Normalize source URI to a cache file:// path then wrap in FormData.
 * Same defense as api/upload.ts:fileFromUri — Android Photo Picker
 * can return content:// URIs that RN FormData mis-handles. Copying via
 * expo-file-system gives a predictable readable file path for multipart.
 */
async function fileFromUri(uri: string, fieldName: string): Promise<FormData> {
  // Shrink before upload (prevents "File too large") — same as api/upload.ts.
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

const UPLOAD_TIMEOUT_MS = 60_000;

// ── Owner-side photo management ──────────────────────────────────────────────

export interface UploadPrivatePhotoResult {
  url: string;
  count: number;
}

export async function uploadPrivatePhoto(uri: string) {
  const fd = await fileFromUri(uri, 'photo');
  return unwrap<UploadPrivatePhotoResult>(
    api.post('/users/private-photos', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      transformRequest: (data) => data,
      timeout: UPLOAD_TIMEOUT_MS,
    }) as any,
  );
}

export const deletePrivatePhoto = (url: string) =>
  unwrap<{ privatePhotos: string[] }>(
    api.delete('/users/private-photos', { data: { url } }) as any,
  );

/** Move one of my PUBLIC photos into the locked private gallery ("设为隐藏"). */
export const movePhotoToPrivate = (url: string) =>
  unwrap<{ photos: string[]; avatarUrl: string | null; privateCount: number }>(
    api.post('/users/private-photos/from-public', { url }) as any,
  );

/** Move one of my PRIVATE photos back into the public gallery ("设为公开"). */
export const movePhotoToPublic = (url: string) =>
  unwrap<{ photos: string[]; avatarUrl: string | null }>(
    api.post('/users/private-photos/to-public', { url }) as any,
  );

export const relockAll = () =>
  unwrap<{ revoked: number }>(
    api.post('/users/private-photos/relock') as any,
  );

export const getApprovedCount = () =>
  unwrap<{ count: number }>(api.get('/users/private-photos/approved-count'));

/** One person who currently has access to my private photos. */
export interface PrivatePhotoViewer {
  requestId: string;
  grantedAt: string | null;
  user: PhotoRequestUser;
}

/** List everyone I've granted access to (for 私密照片管理). */
export const getApprovedViewers = () =>
  unwrap<{ viewers: PrivatePhotoViewer[] }>(
    api.get('/users/private-photos/approved-viewers'),
  );

/** Silently revoke ONE viewer's access (no notification to them). */
export const revokeViewer = (userId: string) =>
  unwrap<{ revoked: number }>(
    api.post(`/users/private-photos/revoke/${userId}`) as any,
  );

/** Silently revoke ALL viewers' access. */
export const revokeAllViewers = () =>
  unwrap<{ revoked: number }>(
    api.post('/users/private-photos/revoke-all') as any,
  );

// ── Owner-side inbox / respond ───────────────────────────────────────────────

/**
 * Status enum mirrors the backend PhotoRequest model. 'expired' is
 * defined server-side but nothing sets it today; treat it like 'rejected'
 * in UI logic.
 */
export type PhotoRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'revoked'
  // 'viewed' = the requester used their single allowed view (view-once).
  | 'viewed';

/** Populated `requester` / `owner` slice — backend selects a slim subset. */
export interface PhotoRequestUser {
  _id: string;
  nickname: string;
  avatarUrl?: string | null;
  level?: number;
  isOnline?: boolean;
  isOfficial?: boolean;
  isVerified?: boolean;
  isPremium?: boolean;
}

export interface PhotoRequest {
  _id: string;
  requester: PhotoRequestUser | null;
  owner: PhotoRequestUser | null;
  status: PhotoRequestStatus;
  respondedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const getInbox = () =>
  unwrap<{ requests: PhotoRequest[] }>(api.get('/photo-requests/inbox'));

export const respondRequest = (requestId: string, accept: boolean) =>
  unwrap<{ requestId: string; status: PhotoRequestStatus }>(
    api.post(`/photo-requests/${requestId}/respond`, {
      status: accept ? 'approved' : 'rejected',
    }) as any,
  );

// ── Requester-side ───────────────────────────────────────────────────────────

export const requestPrivatePhotos = (ownerId: string) =>
  unwrap<{ requestId: string; status: PhotoRequestStatus }>(
    api.post(`/users/${ownerId}/request-photos`) as any,
  );

export const getSent = () =>
  unwrap<{ requests: PhotoRequest[] }>(api.get('/photo-requests/sent'));

/**
 * Fetch the actual private photo URLs for a user. Backend returns
 *   status:'owner'    → caller is the owner, photos are theirs
 *   status:'approved' → caller has an active grant, photos are returned
 *   status:'pending'  → request in flight, no photos
 *   status:'none'     → no relationship, no photos (also covers revoked/rejected)
 */
export type ViewerStatus = 'owner' | 'approved' | 'pending' | 'none' | 'viewed';

// One private photo, detailed. Private-bucket photos (C-1) are served as
// short-lived SIGNED urls and may need refreshing (refreshPrivatePhotoUrl)
// during a long viewing session; legacy public photos have signed=false and
// never expire. `ref` is the stable server-side handle used to re-sign.
export interface PrivatePhotoItem {
  url: string;
  ref: string;
  signed: boolean;
  expiresIn?: number;
}

// `photos` is the back-compat string[] every installed client already reads
// (signed URLs for private-bucket photos, passthrough for legacy). Newer
// backends also send `photosDetailed` so we can refresh expiring signed URLs.
// TODO(private-photos): once the private bucket is live, migrate this screen to
// `photosDetailed` — render `.url`, and pass `.ref` to deletePrivatePhoto so
// deletes match the stored b2priv:// key instead of an expiring signed URL.
// The backend DELETE already tolerates all formats, so this is non-urgent.
export const getPrivatePhotos = (ownerId: string) =>
  unwrap<{
    photos: string[];
    photosDetailed?: PrivatePhotoItem[];
    status: ViewerStatus;
    /** True on the single allowed view (view-once) — show a one-time notice. */
    oneTimeView?: boolean;
  }>(api.get(`/users/${ownerId}/private-photos`));

// Mint a fresh short-lived signed URL for one private-bucket photo. For legacy
// public photos the backend returns the same url with signed=false. Use when a
// cached signed URL is about to expire.
export const refreshPrivatePhotoUrl = (ownerId: string, ref: string) =>
  unwrap<{ url: string; signed: boolean; expiresIn?: number }>(
    api.post('/users/private-photos/signed-url', { ownerId, ref }) as any,
  );
