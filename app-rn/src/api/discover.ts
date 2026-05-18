import { api } from './client';
import type { User } from './me';
import type { InterestTagId } from '../data/interestTags';

export interface DiscoverCardUser extends User {
  /** Server-formatted, rounded to nearest 100m (e.g. "1.2 km", "300 m"). */
  distance: string | null;
  distKm: number | null;
  sharedTags: InterestTagId[];
  /** Index 0–9 picked deterministically server-side; drives placeholder gradient. */
  avatarIdx: number;
}

export type SwipeAction = 'like' | 'pass' | 'super';

export interface SwipeResult {
  match: { id: string; user: User | null } | null;
}

function unwrap<T>(p: Promise<{ data: { data?: T } & T }>): Promise<T> {
  return p.then((r) => {
    const body = r.data as any;
    return (body?.data ?? body) as T;
  });
}

export const getDiscoverCards = (count = 10) =>
  unwrap<DiscoverCardUser[]>(api.get('/discover/cards', { params: { count } }));

export const swipe = (userId: string, action: SwipeAction) =>
  unwrap<SwipeResult>(api.post('/discover/swipe', { userId, action }));

export const getNearby = (radiusKm = 10) =>
  unwrap<DiscoverCardUser[]>(api.get('/discover/nearby', { params: { radiusKm } }));
