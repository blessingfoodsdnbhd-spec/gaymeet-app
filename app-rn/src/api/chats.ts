import { api } from './client';

/** Snapshot of the message a reply quotes (swipe-to-reply). `id`/`senderId` are
 *  null only for defensively-malformed rows; `preview` is a one-line,
 *  language-neutral summary (text content, or 📷 / 🎙️ / 📍 for media). */
export interface MessageReplyPreview {
  id: string | null;
  senderId: string | null;
  type: string | null;
  preview: string;
}

/** Mirrors backend Message document. */
export interface Message {
  id: string;
  _id?: string;
  matchId: string;
  senderId: string;
  /** Empty string for image/location messages (no caption v1). */
  content: string;
  type: 'text' | 'sticker' | 'image' | 'location' | 'voice';
  createdAt: string;
  readBy?: string[];
  /** System message (match greeting) — rendered centered, no bubble. */
  isSystem?: boolean;
  /** Client-only marker for optimistic sends. */
  pendingId?: string;
  status?: 'sending' | 'sent' | 'failed';
  // Image-message fields. mediaUrl is null when the message has been
  // server-side rotated due to TTL (in which case `expired` is true).
  // While the message is still optimistically sending, mediaUrl may
  // hold a local file:// URI from the image picker.
  mediaUrl?: string | null;
  mediaType?: 'image' | 'gif' | null;
  /** Voice-message clip length in milliseconds (rendered in the bubble). */
  duration?: number | null;
  /** Soft scam/phishing flag (item 11) — recipient sees a caution banner. */
  flagged?: boolean;
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
  /** Emoji reactions: { emoji: [userId,…] }. Absent/`{}` when none. */
  reactions?: Record<string, string[]>;
  /** Swipe-to-reply quote target. null/absent for ordinary messages. */
  replyTo?: MessageReplyPreview | null;
}

export interface ChatUser {
  id: string;
  nickname: string;
  avatarUrl?: string | null;
  isOnline?: boolean;
  isPremium?: boolean;
  isVerified?: boolean;
  isOfficial?: boolean;
  countryCode?: string | null;
  /** ISO; null when a Premium user hides presence. */
  lastActiveAt?: string | null;
  dob?: string | null;
  /** Server-formatted distance string, e.g. "3.9 km". */
  distance?: string | null;
  /** Distance in meters for client-side 距离 sort. */
  distanceM?: number | null;
}

export interface ChatThread {
  matchId: string;
  matchedAt: string;
  user: ChatUser;
  lastMessage: string | null;
  lastMessageAt: string | null;
  /** The preview is the auto-generated match greeting (localize + style it). */
  lastMessageSystem?: boolean;
  unreadCount: number;
  source: 'match' | 'dm';
  /** Pinned to the top of the inbox (personal, max 2). */
  isPinned?: boolean;
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

export const sendMessage = (
  matchId: string,
  content: string,
  type: 'text' | 'sticker' = 'text',
  replyToMessageId?: string,
) =>
  unwrap<Message>(
    api.post(`/conversations/${matchId}/send`, { content, type, replyToMessageId }),
  );

/** Image message — caller is expected to have already uploaded the file
 *  to B2 via api/upload.uploadFile() and pass the resulting URL. */
export const sendImageMessage = (matchId: string, mediaUrl: string) =>
  unwrap<Message>(
    api.post(`/conversations/${matchId}/send`, { type: 'image', mediaUrl }),
  );

/** Upload a chat voice clip (file:// uri) → returns the stored audio URL.
 *  Mirrors the image flow: upload first, then sendVoiceMessage with the URL. */
export const uploadChatVoice = (uri: string) => {
  const ext = (uri.split('?')[0].split('.').pop() || 'm4a').toLowerCase();
  const fd = new FormData();
  fd.append('file', { uri, name: `voice.${ext}`, type: `audio/${ext === 'm4a' ? 'm4a' : ext}` } as any);
  return unwrap<{ mediaUrl: string }>(
    api.post('/conversations/voice-upload', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      transformRequest: (d) => d,
      timeout: 60_000,
    }) as any,
  );
};

/** Voice message — caller uploads via uploadChatVoice() first, passes the URL
 *  and the clip duration in milliseconds. */
export const sendVoiceMessage = (matchId: string, mediaUrl: string, duration: number) =>
  unwrap<Message>(
    api.post(`/conversations/${matchId}/send`, { type: 'voice', mediaUrl, duration }),
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

export interface ReactionResult {
  matchId: string;
  messageId: string;
  emoji: string;
  userId: string;
  /** The message's full updated reactions map. */
  reactions: Record<string, string[]>;
  action: 'added' | 'removed';
}

/** Toggle the caller's emoji reaction on a message. Any participant may react
 *  (not owner-gated). Server broadcasts chat:reaction-added/removed to both. */
export const toggleReaction = (matchId: string, msgId: string, emoji: string) =>
  unwrap<ReactionResult>(
    api.post(`/conversations/${matchId}/messages/${msgId}/reactions`, { emoji }),
  );

/** Reliable HTTP mark-as-read — zeroes the caller's unread on this thread.
 *  Used instead of the fire-and-forget WS join_room (which drops when the
 *  socket isn't connected, leaving the unread badge stuck). */
export const markConversationRead = (matchId: string) =>
  unwrap<{ matchId: string; unreadCount: number }>(
    api.post(`/conversations/${matchId}/read`),
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

/** Whether the current user is already matched (同频) with another user, and
 *  the matchId if so — drives the AboutUserSheet 已同频 state (HHHH). */
export const getMatchStatus = (otherUserId: string) =>
  api
    .get(`/matches/with/${otherUserId}`)
    .then((r) => ((r.data?.data ?? r.data) as { matched: boolean; matchId: string | null }));

/** Unmatch — tombstones the Match on the server; both sides receive
 *  a `match:removed` WS event. */
export const deleteConversation = (matchId: string) =>
  unwrap<{ success: true }>(api.delete(`/conversations/${matchId}`));

/** Thrown by pinConversation when the user already has 2 pins (HTTP 409). The
 *  swipe row catches this to show the "max 2 pins" toast. */
export class PinLimitError extends Error {
  constructor() {
    super('PIN_LIMIT');
    this.name = 'PinLimitError';
  }
}

/** Pin a conversation to the top of the inbox (personal, max 2, newest first).
 *  Rejects with PinLimitError on a 3rd pin. */
export const pinConversation = (matchId: string) =>
  unwrap<{ pinned: true }>(
    api.post(`/conversations/${matchId}/pin`),
  ).catch((e: any) => {
    if (e?.response?.status === 409) throw new PinLimitError();
    throw e;
  });

/** Remove a conversation's pin. Idempotent. */
export const unpinConversation = (matchId: string) =>
  unwrap<{ pinned: false }>(api.delete(`/conversations/${matchId}/pin`));

/** Per-user "delete conversation": clears the thread from MY inbox and hides my
 *  history, without unmatching or affecting the other person. Reappears if they
 *  message again. Distinct from deleteConversation (mutual unmatch). */
export const clearConversation = (matchId: string) =>
  unwrap<{ cleared: true }>(api.delete(`/conversations/${matchId}/history`));
