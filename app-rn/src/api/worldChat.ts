import { api } from './client';

/** A World Chat message. No anonymous identities — always a real user. */
export interface WorldChatMessage {
  messageId: string;
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

/** Reverse-chronological history (newest first). Pass `before` (a messageId)
 *  to page older. Backend strips blocked + admin-banned senders. */
export const getRecentWorldChat = (before?: string, limit = 50) =>
  unwrap<{ messages: WorldChatMessage[] }>(
    api.get('/world-chat/recent', { params: { before, limit } }),
  );

/** Send a message. Throws on 429 (rate limit) — inspect
 *  `e.response.data.code === 'RATE_LIMIT'`; 403 = banned. */
export const sendWorldChat = (body: string) =>
  unwrap<WorldChatMessage>(api.post('/world-chat/send', { body }));

export const reportWorldChat = (messageId: string, reason?: string) =>
  api.post('/world-chat/report', { messageId, reason });
