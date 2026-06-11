import { io, Socket } from 'socket.io-client';
import Constants from 'expo-constants';
import { getAccessToken } from '../store/auth';

const baseURL =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  'https://gaymeet-api.onrender.com';

let socket: Socket | null = null;
let connecting: Promise<Socket> | null = null;

/**
 * Connect (or return the existing connection). Lazy + idempotent so that
 * multiple subscribers calling this in parallel get the same socket.
 *
 * The socket survives across screens — disconnect explicitly on sign-out.
 */
export async function connect(): Promise<Socket> {
  if (socket?.connected) return socket;
  if (connecting) return connecting;

  connecting = (async () => {
    const token = await getAccessToken();
    socket = io(baseURL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelayMax: 30_000,
    });
    return socket;
  })();
  try {
    const s = await connecting;
    return s;
  } finally {
    connecting = null;
  }
}

export function disconnect() {
  socket?.disconnect();
  socket = null;
}

export function getSocket() {
  return socket;
}

/**
 * Emit an event when connected — silently no-ops if not. Pairs with the
 * fact that WS payloads are best-effort (server is also the source of truth
 * via HTTP fallback).
 */
export function emit(event: string, payload: unknown) {
  socket?.emit(event, payload);
}

// ── Typed event subscription ───────────────────────────────────────────────

export type WsMatchNew = {
  id: string;
  user: {
    id: string;
    nickname: string;
    avatarUrl?: string | null;
    interests?: string[];
  };
};

export type WsChatReceive = {
  id: string;
  matchId: string;
  senderId: string;
  content: string;
  type: 'text' | 'sticker' | 'image' | 'location';
  createdAt: string;
  readBy?: string[];
  mediaUrl?: string | null;
  mediaType?: 'image' | 'gif' | null;
  location?: { lat: number; lng: number; label?: string | null } | null;
  replyTo?: {
    id: string | null;
    senderId: string | null;
    type: string | null;
    preview: string;
  } | null;
};

export type WsChatTyping = {
  matchId: string;
  fromUserId: string;
  typing: boolean;
};

export type WsChatRead = { matchId: string; readBy: string };
export type WsPresence = { userId: string; online: boolean };

export type WsChatEdited = {
  id: string;
  matchId: string;
  content: string;
  edited: boolean;
  editedAt: string;
};

/** Emoji reaction toggled on a message. `reactions` is the message's FULL
 *  updated map { emoji: [userId,…] } so the client can replace wholesale. */
export type WsChatReaction = {
  matchId: string;
  messageId: string;
  emoji: string;
  userId: string;
  reactions: Record<string, string[]>;
};

export type WsChatDeleted = {
  matchId: string;
  messageId: string;
};

// Topic Personas unlock events — fire when a viewer requests cross-topic
// visibility on an owner, when the owner responds, or when they revoke.
// Payload is the full TopicUnlock row shape; the client just invalidates
// the relevant query caches on receipt.
export type WsTopicUnlock = {
  id: string;
  ownerId: string;
  viewerId: string;
  status: 'pending' | 'approved' | 'rejected' | 'revoked';
  requestedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  revokedAt: string | null;
};

export type WsWorldChatReceive = {
  messageId: string;
  roomId?: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  role?: 'admin' | 'vip' | 'veteran' | 'new' | 'normal';
  countryCode?: string | null;
  city?: string | null;
  body: string;
  createdAt: string;
};
// ── Plaza random matchmaking (Phase 3) ──────────────────────────────────────
export type WsMatchPartner = {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  age: number | null;
  countryCode: string | null;
  city: string | null;
  role: 'admin' | 'vip' | 'veteran' | 'new' | 'normal';
};
/** Fired to a waiting user when a partner arrives. */
export type WsMatchFound = { sessionId: string; partnerId: string; partner: WsMatchPartner };
/** An ephemeral 1-on-1 message from the session partner. */
export type WsMatchMessage = { sessionId: string; fromUserId: string; body: string; createdAt: string };
/** The partner left / tapped Next / the session expired. */
export type WsMatchEnded = { sessionId: string; reason: 'left' | 'next' | 'disconnect' | 'expired' };
/** Reply to a client-emitted `match:next` — same shape as the HTTP join. */
export type WsMatchResult =
  | { status: 'waiting' }
  | { status: 'matched'; sessionId: string; partner: WsMatchPartner | null };

export type WsWorldChatOnlineCount = { roomId?: string; count: number };
export type WsWorldChatRoomsState = { counts: Record<string, number> };
export type WsWorldChatDeleted = { messageId: string };
export type WsWorldChatRoomClosed = { roomId: string };
export type WsWorldChatRoomDeleted = { roomId: string };
export type WsWorldChatKicked = { roomId: string };

export interface WsEventMap {
  'match:new': WsMatchNew;
  'chat:receive': WsChatReceive;
  'world-chat:receive': WsWorldChatReceive;
  'match:found': WsMatchFound;
  'match:message': WsMatchMessage;
  'match:ended': WsMatchEnded;
  'match:result': WsMatchResult;
  'world-chat:online-count': WsWorldChatOnlineCount;
  'world-chat:rooms-state': WsWorldChatRoomsState;
  'world-chat:message-deleted': WsWorldChatDeleted;
  'world-chat:room-closed': WsWorldChatRoomClosed;
  'world-chat:room-deleted': WsWorldChatRoomDeleted;
  'world-chat:kicked': WsWorldChatKicked;
  'chat:typing': WsChatTyping;
  'chat:read': WsChatRead;
  'chat:edited': WsChatEdited;
  'chat:deleted': WsChatDeleted;
  'chat:reaction-added': WsChatReaction;
  'chat:reaction-removed': WsChatReaction;
  'user:online': WsPresence;
  'user:offline': WsPresence;
  'topic-unlock:requested': WsTopicUnlock;
  'topic-unlock:approved': WsTopicUnlock;
  'topic-unlock:rejected': WsTopicUnlock;
  'topic-unlock:revoked': WsTopicUnlock;
}

/**
 * Subscribe to a WS event. Returns an unsubscribe function. Always opens
 * the socket if it isn't connected yet.
 */
export async function on<K extends keyof WsEventMap>(
  event: K,
  handler: (payload: WsEventMap[K]) => void,
): Promise<() => void> {
  const s = await connect();
  const cast = handler as (...args: any[]) => void;
  // socket.io's reserved-event union narrows `K` and confuses TS — widen to string.
  (s as any).on(event, cast);
  return () => (s as any).off(event, cast);
}
