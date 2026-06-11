import { api } from './client';
import type { SearchUser } from './search';

/** Room name in all locales — built-in rooms carry real translations; a custom
 *  room repeats its title across all three. Localize client-side by language. */
export interface RoomLabel {
  en: string;
  zh: string;
  native: string;
}

/** A Plaza message that matched the query, with enough room context to open it. */
export interface PlazaMessageResult {
  messageId: string;
  roomId: string;
  custom: boolean;
  roomFlag: string | null;
  roomLabel: RoomLabel;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  isOfficial?: boolean;
  type?: 'text' | 'photo' | 'voice';
  body: string;
  caption?: string | null;
  createdAt: string;
}

/** A room (built-in or user-created) that matched a name search. */
export interface PlazaRoomResult {
  id: string;
  kind: 'builtin' | 'custom';
  flag: string | null;
  label: RoomLabel;
  onlineCount: number;
  description?: string;
  countryCode?: string;
  memberCount?: number;
  isMember?: boolean;
}

function unwrap<T>(p: Promise<{ data: any }>): Promise<T> {
  return p.then((r) => (r.data?.data ?? r.data) as T);
}

/** Search messages across every room the user can read (`room='*'`) or a single
 *  room. Backend strips blocked + admin-banned senders and private rooms the
 *  user hasn't joined. (CCCCCCC) */
export const searchPlazaMessages = (q: string, room = '*') =>
  unwrap<{ messages: PlazaMessageResult[] }>(api.get('/search/messages', { params: { q, room } }));

/** Search rooms by name — built-in country/world rooms + visible custom rooms. */
export const searchPlazaRooms = (q: string) =>
  unwrap<{ rooms: PlazaRoomResult[] }>(api.get('/search/rooms', { params: { q } }));

/** Search users by name. Pass `room` to find only people who posted in it. */
export const searchPlazaUsers = (q: string, room?: string) =>
  unwrap<{ users: SearchUser[] }>(api.get('/search/users', { params: { q, room } }));
