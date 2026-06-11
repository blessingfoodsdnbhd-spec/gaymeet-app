import { api } from './client';

/** Quoted summary of the message a reply points at. */
export interface WorldChatReplyPreview {
  messageId: string;
  userId: string;
  displayName: string;
  type?: 'text' | 'photo' | 'voice';
  body: string; // one-line preview (caption / '📷' for photos / '🎙️' for voice)
}

/** A World Chat message. No anonymous identities — always a real user. */
export interface WorldChatMessage {
  messageId: string;
  roomId?: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  isOfficial?: boolean;
  /** Plaza role tag (Phase 3) → coloured dot beside the name. */
  roleTag?: import('../components/RoleDot').RoleTag;
  countryCode?: string | null;
  city?: string | null;
  body: string;
  type?: 'text' | 'photo' | 'voice';
  photoUrl?: string | null;
  caption?: string | null;
  voiceUrl?: string | null;
  voiceDurationMs?: number | null;
  voiceWaveform?: number[] | null;
  replyTo?: WorldChatReplyPreview | null;
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

/** Send a text message to a room. Pass `replyToMessageId` to quote another
 *  message. Throws on 429 (rate limit) — inspect
 *  `e.response.data.code === 'RATE_LIMIT'`; 403 = banned. */
export const sendWorldChat = (body: string, roomId = 'world', replyToMessageId?: string) =>
  unwrap<WorldChatMessage>(api.post('/world-chat/send', { body, roomId, replyToMessageId }));

/** Send a photo message (B2 URL already uploaded) with an optional caption and
 *  optional reply target. */
export const sendWorldChatPhoto = (
  photoUrl: string,
  caption?: string,
  roomId = 'world',
  replyToMessageId?: string,
) =>
  unwrap<WorldChatMessage>(
    api.post('/world-chat/send', { type: 'photo', photoUrl, caption, roomId, replyToMessageId }),
  );

/** Send a voice message. The audio is uploaded first (reuse `uploadChatVoice`
 *  from api/chats — the /conversations/voice-upload endpoint is generic), then
 *  this posts the resulting URL + clip length. Optional waveform peaks (0–1). */
export const sendWorldChatVoice = (
  voiceUrl: string,
  voiceDurationMs: number,
  roomId = 'world',
  replyToMessageId?: string,
  voiceWaveform?: number[],
) =>
  unwrap<WorldChatMessage>(
    api.post('/world-chat/send', {
      type: 'voice',
      voiceUrl,
      voiceDurationMs,
      voiceWaveform,
      roomId,
      replyToMessageId,
    }),
  );

export const reportWorldChat = (messageId: string, reason?: string) =>
  api.post('/world-chat/report', { messageId, reason });

/** Delete your OWN message. Backend is owner-only (403 otherwise) and
 *  broadcasts world-chat:message-deleted so every client drops it live. */
export const deleteWorldChatMessage = (messageId: string) =>
  api.delete(`/world-chat/${messageId}`);

// ── Custom chat rooms (forum-style rooms inside a country) ────────────────────

export interface ChatRoomSummary {
  id: string;
  countryCode: string;
  title: string;
  description: string;
  isPrivate: boolean;
  status: 'open' | 'closed';
  creator: { id: string; displayName?: string; avatarUrl?: string | null };
  isCreator: boolean;
  isMember: boolean;
  memberCount: number;
  onlineCount: number;
  lastActiveAt: string;
  createdAt: string;
}

export interface RoomFriend {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export const getCountryRooms = (countryCode: string) =>
  unwrap<{ rooms: ChatRoomSummary[] }>(api.get(`/world-chat/rooms/by-country/${countryCode}`));

export const getChatRoom = (id: string) =>
  unwrap<{ room: ChatRoomSummary }>(api.get(`/world-chat/rooms/${id}`));

export const createChatRoom = (input: {
  countryCode: string;
  title: string;
  description?: string;
  isPrivate: boolean;
  password?: string;
}) => unwrap<ChatRoomSummary>(api.post('/world-chat/rooms', input));

export const joinChatRoom = (id: string, password?: string) =>
  unwrap<{ room: ChatRoomSummary }>(api.post(`/world-chat/rooms/${id}/join`, { password }));

export const leaveChatRoom = (id: string) => api.post(`/world-chat/rooms/${id}/leave`, {});

export const closeChatRoom = (id: string) => api.post(`/world-chat/rooms/${id}/close`, {});

export const deleteChatRoom = (id: string, confirm = false) =>
  api.delete(`/world-chat/rooms/${id}`, { data: { confirm } });

export const updateChatRoom = (
  id: string,
  patch: { title?: string; description?: string; isPrivate?: boolean; password?: string },
) => unwrap<{ room: ChatRoomSummary }>(api.patch(`/world-chat/rooms/${id}`, patch));

export const kickRoomMember = (id: string, userId: string) =>
  api.delete(`/world-chat/rooms/${id}/kick/${userId}`);

export interface RoomMember extends RoomFriend {
  isCreator: boolean;
}

export const getRoomMembers = (id: string) =>
  unwrap<{ members: RoomMember[] }>(api.get(`/world-chat/rooms/${id}/members`));

export const getInvitableFriends = (id: string) =>
  unwrap<{ friends: RoomFriend[] }>(api.get(`/world-chat/rooms/${id}/invitable`));

export const inviteToRoom = (id: string, userIds: string[]) =>
  unwrap<{ invited: number; memberCount: number }>(api.post(`/world-chat/rooms/${id}/invite`, { userIds }));
