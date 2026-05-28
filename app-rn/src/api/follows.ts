import { api } from './client';

function unwrap<T>(p: Promise<{ data: { data?: T } & T }>): Promise<T> {
  return p.then((r) => {
    const body = r.data as any;
    return (body?.data ?? body) as T;
  });
}

/**
 * Toggle follow / unfollow on a user. Backend returns the new state:
 *   { following: true }  — just followed
 *   { following: false } — just unfollowed
 *
 * Callers that only want to add a follow (e.g. an AboutUserSheet button)
 * should still treat the call as idempotent for UX — read the returned
 * `following` flag rather than assume the action.
 */
export const toggleFollow = (userId: string) =>
  unwrap<{ following: boolean }>(api.post(`/users/${userId}/follow`));

export const isFollowing = (userId: string) =>
  unwrap<{ following: boolean }>(api.get(`/users/${userId}/is-following`));
