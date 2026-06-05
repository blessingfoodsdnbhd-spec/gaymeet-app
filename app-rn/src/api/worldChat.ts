import { api } from './client';

/** A World Chat message. No anonymous identities — always a real user. */
export interface WorldChatMessage {
  messageId: string;
  roomId?: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  countryCode?: string | null;
  city?: string | null;
  body: string;
  createdAt: string;
}

function unwrap<T>(p: Promise<{ data: { data?: T } & T }>): Promise<T> {
  return p.then((r) => {
    const body = r.data as any;
    return (body?.data ?? body) as T;
  });
}

export interface WorldChatRoom {
  id: string; // 'world' | 'MY' | 'CN' | …
  flag: string;
  label: { en: string; zh: string; native: string };
  onlineCount: number;
}
export const getWorldChatRooms = () =>
  unwrap<{ rooms: WorldChatRoom[] }>(api.get('/world-chat/rooms'));

/** Reverse-chronological room history (newest first). Pass `before` (a
 *  messageId) to page older. Backend strips blocked + admin-banned senders. */
export const getRecentWorldChat = (roomId = 'world', before?: string, limit = 50) =>
  unwrap<{ messages: WorldChatMessage[] }>(
    api.get('/world-chat/recent', { params: { roomId, before, limit } }),
  );

/** Send a message to a room. Throws on 429 (rate limit) — inspect
 *  `e.response.data.code === 'RATE_LIMIT'`; 403 = banned. */
export const sendWorldChat = (body: string, roomId = 'world') =>
  unwrap<WorldChatMessage>(api.post('/world-chat/send', { body, roomId }));

export const reportWorldChat = (messageId: string, reason?: string) =>
  api.post('/world-chat/report', { messageId, reason });
