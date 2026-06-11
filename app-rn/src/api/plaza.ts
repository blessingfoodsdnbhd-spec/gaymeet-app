import { api } from './client';

function unwrap<T>(p: Promise<{ data: { data?: T } & T }>): Promise<T> {
  return p.then((r) => {
    const body = r.data as any;
    return (body?.data ?? body) as T;
  });
}

/** Room-creation allowance for the current user (drives the quota line). */
export interface TopicRoomQuota {
  isPremium: boolean;
  daily: { used: number; limit: number };
  lifetime: { used: number; limit: number };
}

/** A freshly-created UGC topic room (POST /plaza/rooms/create response). */
export interface CreatedTopicRoom {
  id: string; // `user-topic:<id>`
  title: string;
  emoji: string;
  description: string;
  category: string;
  creator: { id: string; displayName?: string; avatarUrl?: string | null };
  onlineCount: number;
}

export const getTopicRoomQuota = () => unwrap<TopicRoomQuota>(api.get('/plaza/rooms/quota'));

/** Create a UGC topic room. Throws on 429 (quota — inspect
 *  `e.response.data.code` = 'DAILY_QUOTA' | 'LIFETIME_QUOTA'), 422 (content
 *  filter), 403 (voice locked). Returns the created room. */
export const createTopicRoom = (input: { title: string; emoji?: string; description?: string }) =>
  unwrap<CreatedTopicRoom>(api.post('/plaza/rooms/create', { ...input, category: 'topic' }));

/** Report a UGC topic room for moderation. */
export const reportTopicRoom = (roomId: string, reason?: string) =>
  unwrap<{ ok: boolean }>(api.post('/plaza/rooms/report', { roomId, reason }));
