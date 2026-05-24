import { api } from './client';

/** Maps the v2 design's filter chips 1:1 to the backend's `feed` query param. */
export type MomentsFilter = 'all' | 'friends' | 'nearby' | 'interest';

export interface MomentAuthor {
  _id: string;
  nickname: string;
  avatarUrl?: string | null;
  isPremium?: boolean;
  countryCode?: string | null;
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
  tag?: string;
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

export const postMoment = (body: {
  content: string;
  images?: string[];
  visibility?: 'public' | 'friends' | 'private';
}) => unwrap<Moment>(api.post('/moments', body));

// ── Comments ──────────────────────────────────────────────────────────────────
export interface Comment {
  _id: string;
  moment: string;
  user: {
    _id: string;
    nickname: string;
    avatarUrl?: string | null;
  };
  content: string;
  parentComment?: string | null;
  likeCount: number;
  isLiked: boolean;
  createdAt: string;
}

export const getComments = (momentId: string) =>
  unwrap<Comment[]>(api.get(`/moments/${momentId}/comments`));

export const postComment = (momentId: string, content: string) =>
  unwrap<Comment>(api.post(`/moments/${momentId}/comment`, { content }));

export const deleteComment = (momentId: string, commentId: string) =>
  unwrap<{ success: true }>(api.delete(`/moments/${momentId}/comments/${commentId}`));
