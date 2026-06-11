import { api } from './client';
import type { RoleTag } from '../components/RoleDot';

function unwrap<T>(p: Promise<{ data: { data?: T } & T }>): Promise<T> {
  return p.then((r) => {
    const body = r.data as any;
    return (body?.data ?? body) as T;
  });
}

// ── Random matchmaking (❤️ 随机聊天) ─────────────────────────────────────────

/** Partner identity shown in a random-chat header. */
export interface MatchPartner {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  age?: number | null;
  countryCode?: string | null;
  city?: string | null;
  roleTag?: RoleTag;
  roleColor?: string;
  isOnline?: boolean;
}

/** Premium-only partner filters. Free users send {} (ignored server-side). */
export interface MatchFilters {
  ageMin?: number;
  ageMax?: number;
  countryCode?: string;
  gender?: string;
  language?: string;
}

export type JoinResult =
  | { matched: true; sessionId: string; partner: MatchPartner }
  | { matched: false };

/** Join the queue. Either pairs instantly (matched:true) or enqueues
 *  (matched:false) — in which case wait for the `match:found` WS event. */
export const joinMatch = (filters?: MatchFilters) =>
  unwrap<JoinResult>(api.post('/plaza/match/join', { filters }));

/** Stop searching (leave the queue without a match). */
export const cancelMatch = () => unwrap<{ cancelled: true }>(api.post('/plaza/match/cancel', {}));

/** An ephemeral random-chat message (never persisted). */
export interface MatchMessage {
  sessionId: string;
  messageId: string;
  senderId: string;
  body: string;
  createdAt: string;
}

/** Send a text message to the partner. Returns the echoed message to insert. */
export const sendMatchMessage = (sessionId: string, body: string) =>
  unwrap<MatchMessage>(api.post(`/plaza/match/${sessionId}/send`, { body }));

export const sendMatchTyping = (sessionId: string, typing: boolean) =>
  api.post(`/plaza/match/${sessionId}/typing`, { typing });

/** Leave the session (Exit / before Next). Notifies the partner. */
export const endMatch = (sessionId: string) =>
  unwrap<{ ended: true }>(api.post(`/plaza/match/${sessionId}/end`, {}));

/** Convert the random match into a follow (idempotent). */
export const addMatchFriend = (sessionId: string) =>
  unwrap<{ following: true; already?: boolean }>(api.post(`/plaza/match/${sessionId}/add-friend`, {}));

// ── Daily hot leaderboards ───────────────────────────────────────────────────

export interface LeaderboardUserEntry {
  rank: number;
  source: 'ticket' | 'system';
  ticketCount: number;
  user: {
    id: string;
    nickname: string;
    avatarUrl: string | null;
    countryCode?: string | null;
    age?: number | null;
    isBoosted?: boolean;
    isPremium?: boolean;
    popularityScore?: number;
    roleTag?: RoleTag;
  };
}

export interface LeaderboardRoomEntry {
  rank: number;
  roomId: string;
  flag: string;
  label: { en: string; zh: string; native: string };
  messages: number;
  speakers: number;
  onlineCount: number;
}

export const getLeaderboardUsers = (period: 'today' = 'today') =>
  unwrap<LeaderboardUserEntry[]>(api.get('/plaza/leaderboard/users', { params: { period } }));

export const getLeaderboardRooms = (period: 'today' = 'today') =>
  unwrap<LeaderboardRoomEntry[]>(api.get('/plaza/leaderboard/rooms', { params: { period } }));
