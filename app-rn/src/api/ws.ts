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
  type: 'text' | 'sticker' | 'image' | 'audio';
  createdAt: string;
  readBy?: string[];
};

export type WsChatTyping = {
  matchId: string;
  fromUserId: string;
  typing: boolean;
};

export type WsChatRead = { matchId: string; readBy: string };
export type WsPresence = { userId: string; online: boolean };

export interface WsEventMap {
  'match:new': WsMatchNew;
  'chat:receive': WsChatReceive;
  'chat:typing': WsChatTyping;
  'chat:read': WsChatRead;
  'user:online': WsPresence;
  'user:offline': WsPresence;
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
