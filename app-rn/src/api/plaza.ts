import { api } from './client';
import type { PlazaRole } from '../components/RoleDot';

function unwrap<T>(p: Promise<{ data: { data?: T } & T }>): Promise<T> {
  return p.then((r) => {
    const body = r.data as any;
    return (body?.data ?? body) as T;
  });
}

// ── Random matchmaking ───────────────────────────────────────────────────────

/** Premium-only narrowing. Free users always match anyone (filters ignored). */
export interface MatchFilters {
  ageMin?: number;
  ageMax?: number;
  countryCode?: string;
  language?: 'en' | 'zh' | 'ko' | 'ja';
}

/** Public card for the matched partner. */
export interface MatchPartner {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  age: number | null;
  countryCode: string | null;
  city: string | null;
  role: PlazaRole;
}

export type MatchJoinResult =
  | { status: 'waiting' }
  | { status: 'matched'; sessionId: string; partner: MatchPartner | null };

/** Enter the matchmaking queue. Resolves immediately with `matched` if a
 *  partner was already waiting, otherwise `waiting` (the partner arrives via
 *  the WS `match:found` event). */
export const joinMatch = (filters?: MatchFilters) =>
  unwrap<MatchJoinResult>(api.post('/plaza/match/join', { filters }));

/** Drop the current match and find another. */
export const nextMatch = () => unwrap<MatchJoinResult>(api.post('/plaza/match/next', {}));

/** Leave matchmaking entirely (queue + any session). */
export const leaveMatch = () => unwrap<{ ok: boolean }>(api.post('/plaza/match/leave', {}));

// ── Daily leaderboards ───────────────────────────────────────────────────────

export interface LeaderboardRoom {
  id: string;
  kind: 'builtin' | 'custom';
  flag: string;
  label: { en: string; zh: string; native: string };
  onlineCount: number;
}

export interface LeaderboardUser {
  rank: number;
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  role: PlazaRole;
  xp: number;
}

export const getRoomLeaderboard = (period: 'today' | 'yesterday' = 'today') =>
  unwrap<{ rooms: LeaderboardRoom[] }>(api.get('/plaza/leaderboard/rooms', { params: { period } }));

export const getUserLeaderboard = (period: 'today' | 'yesterday' = 'today') =>
  unwrap<{ period: string; day: string; users: LeaderboardUser[] }>(
    api.get('/plaza/leaderboard/users', { params: { period } }),
  );
