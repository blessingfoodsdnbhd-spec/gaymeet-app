import * as FileSystem from 'expo-file-system';
import { api } from './client';

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

export const relockAll = () =>
  unwrap<{ revoked: number }>(
    api.post('/users/private-photos/relock') as any,
  );

export const getApprovedCount = () =>
  unwrap<{ count: number }>(api.get('/users/private-photos/approved-count'));

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
  | 'revoked';

/** Populated `requester` / `owner` slice — backend selects a slim subset. */
export interface PhotoRequestUser {
  _id: string;
  nickname: string;
  avatarUrl?: string | null;
  level?: number;
  isOnline?: boolean;
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
export type ViewerStatus = 'owner' | 'approved' | 'pending' | 'none';

export const getPrivatePhotos = (ownerId: string) =>
  unwrap<{ photos: string[]; status: ViewerStatus }>(
    api.get(`/users/${ownerId}/private-photos`),
  );
