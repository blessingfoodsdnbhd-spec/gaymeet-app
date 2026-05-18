import { api } from './client';

/** Mirrors backend Message document. */
export interface Message {
  id: string;
  _id?: string;
  matchId: string;
  senderId: string;
  content: string;
  type: 'text' | 'sticker' | 'image' | 'audio';
  createdAt: string;
  readBy?: string[];
  /** Client-only marker for optimistic sends. */
  pendingId?: string;
  status?: 'sending' | 'sent' | 'failed';
}

export interface ChatUser {
  id: string;
  nickname: string;
  avatarUrl?: string | null;
  isOnline?: boolean;
  isPremium?: boolean;
  isVerified?: boolean;
  countryCode?: string | null;
}

export interface ChatThread {
  matchId: string;
  matchedAt: string;
  user: ChatUser;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  source: 'match' | 'dm';
}

function unwrap<T>(p: Promise<{ data: { data?: T } & T }>): Promise<T> {
  return p.then((r) => {
    const body = r.data as any;
    return (body?.data ?? body) as T;
  });
}

export const getConversations = () =>
  unwrap<ChatThread[]>(api.get('/conversations'));

/** Messages history for a thread, addressed by the OTHER user's id (backend
 *  convention — it resolves to matchId server-side). */
export const getMessages = (otherUserId: string, before?: string) =>
  unwrap<Message[]>(
    api.get(`/conversations/${otherUserId}/messages`, {
      params: { before, limit: 50 },
    }),
  );

export const sendMessage = (matchId: string, content: string, type: 'text' | 'sticker' = 'text') =>
  unwrap<Message>(api.post(`/conversations/${matchId}/send`, { content, type }));

/** Find existing match or create a new dm thread (charges no coins in v2). */
export const openConversation = (otherUserId: string) =>
  unwrap<{ matchId: string; coinsCharged: number }>(
    api.post(`/conversations/open/${otherUserId}`),
  );
