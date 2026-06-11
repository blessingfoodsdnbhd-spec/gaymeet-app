import { api } from './client';

function unwrap<T>(p: Promise<{ data: { data?: T } & T }>): Promise<T> {
  return p.then((r) => {
    const body = r.data as any;
    return (body?.data ?? body) as T;
  });
}

// ── Interest channels (兴趣频道) ──────────────────────────────────────────────
export interface InterestChannel {
  id: string; // 'interest:games' — doubles as the World-Chat roomId
  key: string;
  emoji: string;
  i18nKey: string; // e.g. 'plaza.channel.games' — client localizes the label
  name: string; // English fallback name
  description: string;
  pinned: boolean;
  onlineCount: number;
}
export const getInterestChannels = () =>
  unwrap<{ channels: InterestChannel[] }>(api.get('/plaza/channels'));

// ── Online users in a room (mIRC-style list) ──────────────────────────────────
export interface OnlineUser {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  isOfficial: boolean;
  isPremium: boolean;
  countryCode?: string | null;
  city?: string | null;
  level: number;
}
export const getRoomOnline = (roomId: string) =>
  unwrap<{ online: number; users: OnlineUser[] }>(
    api.get(`/plaza/rooms/${encodeURIComponent(roomId)}/online`),
  );

// ── Leaderboard ───────────────────────────────────────────────────────────────
export type LeaderboardPeriod = 'daily' | 'weekly' | 'all';
export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  isOfficial: boolean;
  isPremium: boolean;
  xp: number;
  level: number;
}
export const getLeaderboard = (period: LeaderboardPeriod = 'weekly') =>
  unwrap<{ period: LeaderboardPeriod; leaderboard: LeaderboardEntry[] }>(
    api.get('/plaza/leaderboard', { params: { period } }),
  );

// ── A user's chat-XP level + progress ─────────────────────────────────────────
export interface LevelInfo {
  totalXP: number;
  level: number;
  levelName: string; // i18n key, e.g. 'level.lv5'
  currentLevelXP: number;
  nextLevelXP: number | null; // null when maxed out
  nextLevel: number | null;
  progress: number; // 0..1 toward the next tier
}
/** Pass 'me' for the signed-in user. */
export const getUserLevel = (userId: string) =>
  unwrap<LevelInfo>(api.get(`/users/${userId}/level`));
