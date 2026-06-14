import { getRecentWorldChat, type WorldChatMessage } from '../api/worldChat';

// Tiny in-memory preview cache (30s TTL) for the room long-press preview.
// (No Redis on the backend — this client-side cache keeps repeated long-presses
// from re-hitting /recent for the same room.)
const TTL_MS = 30_000;
const cache = new Map<string, { messages: WorldChatMessage[]; at: number }>();

/** Last ~5 messages for a room, cached for 30s. Returns [] on error. */
export async function getRoomPreview(roomId: string): Promise<WorldChatMessage[]> {
  const hit = cache.get(roomId);
  const now = Date.now();
  if (hit && now - hit.at < TTL_MS) return hit.messages;
  try {
    const res = await getRecentWorldChat(roomId, undefined, 5);
    const messages = res.messages ?? [];
    cache.set(roomId, { messages, at: now });
    return messages;
  } catch {
    return hit?.messages ?? [];
  }
}
