import { api } from './client';

/** Mirrors backend Message document. */
export interface Message {
  id: string;
  _id?: string;
  matchId: string;
  senderId: string;
  /** Empty string for image/location messages (no caption v1). */
  content: string;
  type: 'text' | 'sticker' | 'image' | 'location';
  createdAt: string;
  readBy?: string[];
  /** Client-only marker for optimistic sends. */
  pendingId?: string;
  status?: 'sending' | 'sent' | 'failed';
  // Image-message fields. mediaUrl is null when the message has been
  // server-side rotated due to TTL (in which case `expired` is true).
  // While the message is still optimistically sending, mediaUrl may
  // hold a local file:// URI from the image picker.
  mediaUrl?: string | null;
  mediaType?: 'image' | 'gif' | null;
  /** Server-side flag set when the 30-day TTL has passed AND/OR the
   *  admin cleanup pass has nullified mediaUrl. Client renders an
   *  "Photo expired" placeholder. */
  expired?: boolean;
  expiresAt?: string | null;
  // Location-message field.
  location?: { lat: number; lng: number; label?: string | null } | null;
  // Edit metadata (Phase 2f).
  edited?: boolean;
  editedAt?: string | null;
}

export interface ChatUser {
  id: string;
  nickname: string;
  avatarUrl?: string | null;
  isOnline?: boolean;
  isPremium?: boolean;
  isVerified?: boolean;
  countryCode?: string | null;
  /** ISO; null when a Premium user hides presence. */
  lastActiveAt?: string | null;
  dob?: string | null;
  /** Server-formatted distance string, e.g. "3.9 km". */
  distance?: string | null;
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

/** Image message — caller is expected to have already uploaded the file
 *  to B2 via api/upload.uploadFile() and pass the resulting URL. */
export const sendImageMessage = (matchId: string, mediaUrl: string) =>
  unwrap<Message>(
    api.post(`/conversations/${matchId}/send`, { type: 'image', mediaUrl }),
  );

/** Location message — lat/lng required, label is the reverse-geocode
 *  string (server slices to 200 chars). */
export const sendLocationMessage = (
  matchId: string,
  lat: number,
  lng: number,
  label?: string | null,
) =>
  unwrap<Message>(
    api.post(`/conversations/${matchId}/send`, {
      type: 'location',
      location: { lat, lng, label: label ?? null },
    }),
  );

export interface EditedMessage {
  id: string;
  matchId: string;
  content: string;
  edited: boolean;
  editedAt: string;
}

/** Edit own text message. Premium-only, text-only, within 24h. Backend
 *  enforces — see PATCH /:matchId/messages/:msgId. */
export const editMessage = (matchId: string, msgId: string, content: string) =>
  unwrap<EditedMessage>(
    api.patch(`/conversations/${matchId}/messages/${msgId}`, { content }),
  );

/** Delete own message. Premium-only. Any type. */
export const deleteMessage = (matchId: string, msgId: string) =>
  unwrap<{ messageId: string }>(
    api.delete(`/conversations/${matchId}/messages/${msgId}`),
  );

/**
 * Find existing match or open a new dm. If the target user is already
 * matched, opening is free. Otherwise the backend charges 10 coins from
 * User.coins — a 402 response signals "not enough balance".
 */
export const openConversation = (otherUserId: string) =>
  unwrap<{ matchId: string; coinsCharged: number; balance?: number }>(
    api.post(`/conversations/open/${otherUserId}`),
  );

/** Unmatch — tombstones the Match on the server; both sides receive
 *  a `match:removed` WS event. */
export const deleteConversation = (matchId: string) =>
  unwrap<{ success: true }>(api.delete(`/conversations/${matchId}`));
