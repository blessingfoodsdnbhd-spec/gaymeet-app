import { api } from './client';

/** Quoted summary of the message a reply points at. */
export interface WorldChatReplyPreview {
  messageId: string;
  userId: string;
  displayName: string;
  type?: 'text' | 'photo' | 'voice';
  body: string; // one-line preview (caption / '📷' for photos / '🎙️' for voice)
}

/** Plaza identity tier (spec §9.3). Drives the username color + emoji badge. */
export type PlazaTier = 'admin' | 'vip' | 'legend' | 'old' | 'normal' | 'new';

/** Compact identity attached to chat senders + roster entries (spec §9.2/§9.3). */
export interface PlazaIdentity {
  tier: PlazaTier;
  level: number;
}

/** A World Chat message. No anonymous identities — always a real user. */
export interface WorldChatMessage {
  messageId: string;
  roomId?: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  isOfficial?: boolean;
  isVerified?: boolean;
  isPremium?: boolean;
  /** Plaza identity tier + level (§9.2/§9.3). Absent on legacy/system rows. */
  identity?: PlazaIdentity;
  countryCode?: string | null;
  city?: string | null;
  body: string;
  type?: 'text' | 'photo' | 'voice' | 'system';
  /** Client-only ephemeral system line (mIRC-style). Never persisted nor
   *  returned by the server — synthesized from world-chat:user-joined/left and
   *  world-chat:level-up. */
  system?: { kind: 'join' | 'leave'; name: string } | { kind: 'levelup'; name: string; level: number; titleKey?: string | null };
  photoUrl?: string | null;
  caption?: string | null;
  voiceUrl?: string | null;
  voiceDurationMs?: number | null;
  voiceWaveform?: number[] | null;
  replyTo?: WorldChatReplyPreview | null;
  createdAt: string;
  /** Set once the author edits the text via PATCH /world-chat/:messageId. */
  edited?: boolean;
  editedAt?: string | null;
}

function unwrap<T>(p: Promise<{ data: { data?: T } & T }>): Promise<T> {
  return p.then((r) => {
    const body = r.data as any;
    return (body?.data ?? body) as T;
  });
}

export interface WorldChatRoom {
  id: string; // 'world' | 'MY' | 'topic:late-night' | 'country:my:general' | …
  flag: string;
  label: { en: string; zh: string; native: string };
  /** Room category. 'country-sub' = a country's sub-board (general/social/…). */
  kind?: 'topic' | 'country' | 'friend' | 'interest' | 'voice' | 'country-sub';
  /** Present for topic/interest/sub-channel rooms — resolve the name with t(). */
  i18nKey?: string;
  /** country-sub only: parent country code + sub-channel key. */
  country?: string;
  sub?: string;
  /** country-sub only: parent country's localized name, used to prefix the
   * sub-board name (e.g. "马来西亚" → "马来西亚总聊天室"). */
  countryLabel?: { en: string; zh: string; native: string };
  onlineCount: number;
}

/** 🎤 voice room placeholder (display-only — voice infra ships in Phase 4). */
export interface PlazaVoiceRoomDTO {
  id: string;
  emoji: string;
  i18nKey: string;
}

/** A country sub-channel definition (general/social/newcomers/events). */
export interface PlazaSubChannelDTO {
  key: string;
  emoji: string;
  i18nKey: string;
}

export interface PlazaRoomsResponse {
  rooms: WorldChatRoom[];
  voiceRooms: PlazaVoiceRoomDTO[];
  subChannels: PlazaSubChannelDTO[];
}

export const getWorldChatRooms = () =>
  unwrap<PlazaRoomsResponse>(api.get('/world-chat/rooms'));

/** 🔥 热门聊天室 — a pure ranking of every room by live online count, top N
 *  (default 5). Powers the Plaza 热门 sheet; refresh on an interval for a live feel. */
export const getHotWorldChatRooms = (limit = 5) =>
  unwrap<PlazaRoomsResponse>(api.get('/world-chat/rooms', { params: { sort: 'hot', limit } }));

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

// ── Auto-translate ────────────────────────────────────────────────────────────

export interface MessageTranslation {
  original: string;
  /** Source language Google detected, normalized (e.g. 'zh'). */
  detectedLang: string | null;
  /** Translated text, or null when the message is already in `to`. */
  translated: string | null;
  to: string;
}

/** Lazily translate one world-chat message into `to` (en/zh/ko/ja). Backend
 *  caches the result on the message, so repeat calls are free. Throws 503 when
 *  translation isn't configured, 429 (`code: 'RATE_LIMIT'`) when the per-user
 *  rate limit is hit. */
export const translateWorldChatMessage = (messageId: string, to: string) =>
  unwrap<MessageTranslation>(api.post('/world-chat/translate', { messageId, to }));

/** Delete your OWN message. Backend is owner-only (403 otherwise) and
 *  broadcasts world-chat:message-deleted so every client drops it live. */
export const deleteWorldChatMessage = (messageId: string) =>
  api.delete(`/world-chat/${messageId}`);

/** Edit your OWN text message. Premium-only + owner-only + text-only (backend
 *  enforces; 402 = premium required, 403 = not owner, 410 = too old/non-text).
 *  Broadcasts world-chat:message-edited so every client updates it live. */
export const editWorldChatMessage = (messageId: string, body: string) =>
  unwrap<WorldChatMessage>(api.patch(`/world-chat/${messageId}`, { body }));

// ── Custom chat rooms (forum-style rooms inside a country) ────────────────────

export interface ChatRoomSummary {
  id: string;
  /** Parent 二级频道 — country code or friend:/voice:/interest: id (Phase 4). */
  channelId?: string | null;
  countryCode: string;
  title: string;
  description: string;
  /** 自建房卡片背景色 — a hex from roomColors PALETTE (spec 等级解锁). */
  cardColor?: string;
  isPrivate: boolean;
  status: 'open' | 'closed';
  creator: { id: string; displayName?: string; avatarUrl?: string | null };
  isCreator: boolean;
  isMember: boolean;
  memberCount: number;
  /** Message retention window in days: 7 / 30, or 0 = 无限 (Premium). */
  retentionDays?: number;
  onlineCount: number;
  lastActiveAt: string;
  createdAt: string;
}

/** 我在的房间 — a room the user subscribed to (joined, not owned). Extends the
 *  room summary with the per-room mute flag + unread count. */
export interface JoinedRoom extends ChatRoomSummary {
  notificationsEnabled: boolean;
  unread: number;
  lastReadAt?: string | null;
}

export interface RoomFriend {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  isOnline?: boolean;
  lastActiveAt?: string | null;
  isOfficial?: boolean;
  isVerified?: boolean;
  isPremium?: boolean;
}

export const getCountryRooms = (countryCode: string) =>
  unwrap<{ rooms: ChatRoomSummary[] }>(api.get(`/world-chat/rooms/by-country/${countryCode}`));

/** The user-created (UGC) rooms inside any 二级频道 (country code or
 *  friend:/voice:/interest: id), sorted by live online count desc (spec §5.4). */
export const getChannelRooms = (channelId: string) =>
  unwrap<{ rooms: ChatRoomSummary[] }>(
    api.get(`/world-chat/rooms/by-channel/${encodeURIComponent(channelId)}`),
  );

/** 我开的房间 — the current user's own open rooms + their create-quota cap. */
export const getMyRooms = () =>
  unwrap<{ rooms: ChatRoomSummary[]; cap: number; isPremium: boolean }>(
    api.get('/world-chat/rooms/mine'),
  );

export const getChatRoom = (id: string) =>
  unwrap<{ room: ChatRoomSummary }>(api.get(`/world-chat/rooms/${id}`));

export const createChatRoom = (input: {
  /** Parent 二级频道. Country code OR friend:/voice:/interest: id (Phase 4). */
  channelId: string;
  title: string;
  description?: string;
  /** A roomColors PALETTE hex the creator has unlocked (defaults to Lv1). */
  cardColor?: string;
  isPrivate: boolean;
  password?: string;
}) => unwrap<ChatRoomSummary>(api.post('/world-chat/rooms', input));

export const joinChatRoom = (id: string, password?: string) =>
  unwrap<{ room: ChatRoomSummary }>(api.post(`/world-chat/rooms/${id}/join`, { password }));

export const leaveChatRoom = (id: string) => api.post(`/world-chat/rooms/${id}/leave`, {});

export const closeChatRoom = (id: string) => api.post(`/world-chat/rooms/${id}/close`, {});

/**
 * Re-open a closed room. v3.1.11 STUB — the backend POST /rooms/:id/reopen route
 * does NOT exist yet (only /close does); this 404s until codex adds it. The
 * EditRoom UI catches the error and toasts. See .agents/collab.md.
 */
export const reopenChatRoom = (id: string) => api.post(`/world-chat/rooms/${id}/reopen`, {});

export const deleteChatRoom = (id: string, confirm = false) =>
  api.delete(`/world-chat/rooms/${id}`, { data: { confirm } });

export const updateChatRoom = (
  id: string,
  patch: {
    title?: string;
    description?: string;
    cardColor?: string;
    isPrivate?: boolean;
    password?: string;
    /** 保留期 — 7 / 30, or 0 = 无限 (Premium; backend returns 402 otherwise). */
    retentionDays?: number;
  },
) => unwrap<{ room: ChatRoomSummary }>(api.patch(`/world-chat/rooms/${id}`, patch));

// ── 我在的房间 / Room memberships (Build 102) ──────────────────────────────────

/** Rooms the user joined but does NOT own, with unread counts + mute state. */
export const getJoinedRooms = () =>
  unwrap<{ rooms: JoinedRoom[] }>(api.get('/world-chat/rooms/joined'));

/** Idempotently subscribe to a custom room + mark it read. Call on room entry. */
export const enterRoom = (id: string) =>
  api.post(`/world-chat/rooms/${id}/enter`, {});

/** Advance the unread high-water mark (on entry / on receiving live messages). */
export const markRoomRead = (id: string) =>
  api.post(`/world-chat/rooms/${id}/mark-read`, {});

/** 静音 — per-room mute toggle (server-authoritative; drives push fan-out). */
export const setRoomNotifications = (id: string, notificationsEnabled: boolean) =>
  unwrap<{ ok: boolean; notificationsEnabled: boolean }>(
    api.patch(`/world-chat/rooms/${id}/membership`, { notificationsEnabled }),
  );

/** 离开房间 — unsubscribe from 我在的房间 (also leaves the underlying room). */
export const leaveRoomMembership = (id: string) =>
  api.delete(`/world-chat/rooms/${id}/membership`);

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

// ── Online roster (mIRC 在线名单, spec §9.1) ───────────────────────────────────
// Pushed over the socket, not REST. Request with emit('world-chat:request-roster',
// { roomId }); listen on 'world-chat:roster'. Also broadcast to a room on every
// join/leave so the sidebar stays live.

/** One person in a room's online roster. */
export interface PlazaRosterUser {
  userId: string;
  name: string;
  avatarUrl: string | null;
  tier: PlazaTier;
  level: number;
}

export interface PlazaRoster {
  roomId: string;
  online: number;
  /** Sorted by identity tier → level desc → join order (spec §9.1). */
  users: PlazaRosterUser[];
}
