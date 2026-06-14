import { api } from './client';

/** Maps the v2 design's filter chips 1:1 to the backend's `feed` query param. */
export type MomentsFilter = 'all' | 'friends' | 'nearby' | 'interest';

export interface MomentAuthor {
  _id: string;
  nickname: string;
  avatarUrl?: string | null;
  isOfficial?: boolean;
  isVerified?: boolean;
  isPremium?: boolean;
  countryCode?: string | null;
}

/** Populated tagged friend (subset returned by the backend). */
export interface TaggedFriend {
  _id: string;
  nickname: string;
  avatarUrl?: string | null;
}

export interface Moment {
  _id: string;
  user: MomentAuthor;
  content: string;
  images?: string[];
  visibility?: 'public' | 'friends' | 'private';
  likeCount: number;
  isLiked: boolean;
  commentCount?: number;
  createdAt: string;
  /** Set when this is an ephemeral 24h moment (STORY1). */
  expiresAt?: string | null;
  tag?: string;
  /** Friends tagged in this post (FB-style). */
  taggedUserIds?: TaggedFriend[];
  /** Human-readable place label (legacy/optional — display is map-based, QQQ). */
  locationLabel?: string | null;
  /** GeoJSON point: coordinates are [lng, lat]. Drives the "View on map" link. */
  location?: { type?: string; coordinates?: number[] } | null;
}

function unwrap<T>(p: Promise<{ data: { data?: T } & T }>): Promise<T> {
  return p.then((r) => {
    const body = r.data as any;
    return (body?.data ?? body) as T;
  });
}

export const getMoments = (filter: MomentsFilter = 'all', page = 1) =>
  unwrap<Moment[]>(
    api.get('/moments', {
      params: filter === 'all' ? { page, limit: 20 } : { feed: filter, page, limit: 20 },
    }),
  );

/** Fetch moments authored by a specific user. Backend route uses the same
 *  GET /moments handler with a userId query param — see moments.js. */
export const getUserMoments = (userId: string, page = 1) =>
  unwrap<Moment[]>(
    api.get('/moments', { params: { userId, page, limit: 20 } }),
  );

export const toggleLike = (id: string) =>
  unwrap<{ likeCount: number; isLiked: boolean }>(api.post(`/moments/${id}/like`));

export interface MomentLiker {
  _id: string;
  nickname: string;
  avatarUrl?: string | null;
  isVerified?: boolean;
  isOfficial?: boolean;
  isPremium?: boolean;
  followStatus?: 'mutual' | 'following' | 'followed-by' | 'none';
  isFollowing?: boolean;
}

/** Users who liked a moment, newest-first (≤50/page). */
export const getMomentLikers = (momentId: string, page = 1): Promise<MomentLiker[]> =>
  api
    .get(`/moments/${momentId}/likes`, { params: { page, limit: 50 } })
    .then((r: any) => (r.data?.data ?? r.data)?.likers ?? []);

/**
 * Soft-delete a moment (the author's own). Backend sets isActive=false;
 * GET single returns 404 afterwards and the feeds drop the row. Required
 * by Apple guideline 1.2 — user must be able to delete their own UGC.
 */
export const deleteMoment = (id: string) =>
  unwrap<{ success: true }>(api.delete(`/moments/${id}`));

export const postMoment = (body: {
  content: string;
  images?: string[];
  visibility?: 'public' | 'friends' | 'private';
  /** Tagged friends (ids the author follows / who follow them; ≤10). */
  taggedUserIds?: string[];
  /** Location: lat/lng + a display label. */
  lat?: number;
  lng?: number;
  locationLabel?: string;
  /** Ephemeral "24h story" — auto-expires after this many hours (STORY1). */
  expiresInHours?: number;
}) => unwrap<Moment>(api.post('/moments', body));

/**
 * Edit your OWN moment (content / images / location / tagged friends). Free and
 * Premium alike — not gated. Pass `lat:null, lng:null` to CLEAR an existing
 * location. Backend: PATCH /moments/:id (ownership-checked).
 */
export const patchMoment = (
  id: string,
  body: {
    content: string;
    images?: string[];
    taggedUserIds?: string[];
    lat?: number | null;
    lng?: number | null;
    locationLabel?: string | null;
  },
) => unwrap<Moment>(api.patch(`/moments/${id}`, body));

// ── Comments ──────────────────────────────────────────────────────────────────
export interface Comment {
  _id: string;
  moment: string;
  user: {
    _id: string;
    nickname: string;
    avatarUrl?: string | null;
    isOfficial?: boolean;
    isVerified?: boolean;
    isPremium?: boolean;
  };
  content: string;
  photoUrl?: string | null;
  parentComment?: string | null;
  /** true when the commenter is the moment's author (→ 作者 badge). */
  isAuthor: boolean;
  createdAt: string;
}

/** Full flat comment list, newest first. The client groups into threads. */
export const getComments = (momentId: string) =>
  unwrap<Comment[]>(api.get(`/moments/${momentId}/comments`));

export const postComment = (
  momentId: string,
  body: { content?: string; photoUrl?: string; parentCommentId?: string },
) => unwrap<Comment>(api.post(`/moments/${momentId}/comment`, body));

export const deleteComment = (momentId: string, commentId: string) =>
  unwrap<{ success: true }>(api.delete(`/moments/${momentId}/comments/${commentId}`));
