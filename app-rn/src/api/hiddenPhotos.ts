import { api } from './client';

function unwrap<T>(p: Promise<{ data: { data?: T } & T }>): Promise<T> {
  return p.then((r) => {
    const body = r.data as any;
    return (body?.data ?? body) as T;
  });
}

/** Request lifecycle status, mirrors the backend HiddenPhotoRequest model. */
export type HiddenRequestStatus = 'none' | 'pending' | 'approved' | 'rejected';

/** Slim user card the backend returns in grant / request lists. */
export interface HiddenPhotoUser {
  _id: string;
  nickname: string;
  avatarUrl?: string | null;
  level?: number;
  isOnline?: boolean;
  isOfficial?: boolean;
  isVerified?: boolean;
  isPremium?: boolean;
}

// ── Cross-user: request / respond / view ─────────────────────────────────────

/**
 * Fetch a user's hidden photos. When `granted` is false only `count` + the
 * requester's `requestStatus` come back (no URLs). Owner-self returns owner:true.
 */
export interface HiddenPhotosView {
  granted: boolean;
  owner?: boolean;
  count: number;
  photos: string[];
  requestStatus?: HiddenRequestStatus;
}
export const getHiddenPhotos = (userId: string) =>
  unwrap<HiddenPhotosView>(api.get(`/hidden-photos/${userId}`));

/** Ask to view someone's hidden photos. */
export interface RequestResult {
  status: 'pending' | 'already_pending' | 'approved';
  requestId?: string;
  alreadyGranted?: boolean;
}
export const requestHiddenPhotos = (targetUserId: string) =>
  unwrap<RequestResult>(api.post(`/hidden-photos/request/${targetUserId}`));

/** Owner approves or rejects a request. */
export const respondHiddenRequest = (requestId: string, action: 'approve' | 'reject') =>
  unwrap<{ status: 'approved' | 'rejected'; requestId: string }>(
    api.post(`/hidden-photos/respond/${requestId}`, { action }),
  );

// ── Owner self-management (/me/hidden-photos/*) ──────────────────────────────

/** Flag one of my photos hidden (true) or public (false). */
export const toggleHiddenPhoto = (photoUrl: string, hidden: boolean) =>
  unwrap<{ photos: string[]; hiddenPhotos: string[]; hiddenPhotosCount: number }>(
    api.post('/me/hidden-photos/toggle', { photoUrl, hidden }),
  );

export interface HiddenGrant {
  user: HiddenPhotoUser;
  grantedAt: string;
  source: 'request' | 'manual' | 'match';
}
export const getHiddenGrants = () =>
  unwrap<{ count: number; grants: HiddenGrant[] }>(api.get('/me/hidden-photos/grants'));

export interface HiddenRequest {
  id: string;
  fromUser: HiddenPhotoUser;
  toUserId: string;
  status: HiddenRequestStatus;
  createdAt: string;
  respondedAt: string | null;
}
export const getHiddenRequests = (status?: 'pending' | 'approved' | 'rejected') =>
  unwrap<{ requests: HiddenRequest[] }>(
    api.get('/me/hidden-photos/requests', { params: status ? { status } : undefined }),
  );

/** Proactively open my hidden photos to someone. */
export const grantHiddenPhotos = (userId: string) =>
  unwrap<{ granted: boolean; count: number }>(api.post(`/me/hidden-photos/grant/${userId}`));

/** Revoke someone's access. */
export const revokeHiddenPhotos = (userId: string) =>
  unwrap<{ revoked: boolean; count: number }>(api.post(`/me/hidden-photos/revoke/${userId}`));
