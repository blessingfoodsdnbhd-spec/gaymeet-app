import { api } from './client';
import type { User } from './me';
import type { InterestTagId } from '../data/interestTags';
import type { DistanceBucket } from '../utils/distanceBucket';

export interface DiscoverCardUser extends User {
  /** Server-formatted coarse label ("< 1 km", "1-5 km"). Prefer rendering
   *  `distanceBucket` through utils/distanceBucket so it's localised; this is
   *  the ASCII fallback for older backends. */
  distance: string | null;
  // `distanceBucket` (Apple 5.1.2(i)) is inherited from User — declaring it
  // again as required would break the several callsites that synthesise a card
  // locally (GlobalMatchListener, useAboutUserSheet) from a plain User.
  /** Always null now — kept so existing callsites still type-check. A precise
   *  kilometre value would defeat the bucket it sits next to. */
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

export interface DiscoverFilters {
  radiusKm?: number;
  interests?: InterestTagId[];
}

export const getDiscoverCards = (count = 10, filters?: DiscoverFilters) =>
  unwrap<DiscoverCardUser[]>(
    api.get('/discover/cards', {
      params: {
        count,
        // `!= null` (not `?`) so we DO send radiusKm=0 — that's the
        // "不限 / unlimited" sentinel. Backend treats 0 as "no cap".
        // Using `?` here would drop 0 → backend reverts to 10km default.
        ...(filters?.radiusKm != null ? { radiusKm: filters.radiusKm } : {}),
        ...(filters?.interests && filters.interests.length > 0
          ? { interests: filters.interests.join(',') }
          : {}),
      },
    }),
  );

export const swipe = (userId: string, action: SwipeAction) =>
  unwrap<SwipeResult>(api.post('/discover/swipe', { userId, action }));

/** Radar "search for new nearby friends" — recently-active candidates within
 *  radius, sorted by shared interests then distance. Returns the same card
 *  shape as getDiscoverCards so results drop straight into the deck. */
export const searchNewFriends = (filters?: DiscoverFilters) =>
  unwrap<DiscoverCardUser[]>(
    api.post('/discover/search-new', {
      count: 15,
      ...(filters?.radiusKm != null ? { radiusKm: filters.radiusKm } : {}),
      ...(filters?.interests && filters.interests.length > 0
        ? { interests: filters.interests.join(',') }
        : {}),
    }),
  );

export const getNearby = (radiusKm = 0, filters?: DiscoverFilters) =>
  unwrap<DiscoverCardUser[]>(
    api.get('/discover/nearby', {
      params: {
        // Use `??` so 0 (the unlimited sentinel from FiltersSheet) passes
        // through verbatim. Don't use `||` (would treat 0 as falsy and
        // silently revert to default).
        radiusKm: filters?.radiusKm ?? radiusKm,
        ...(filters?.interests && filters.interests.length > 0
          ? { interests: filters.interests.join(',') }
          : {}),
      },
    }),
  );
