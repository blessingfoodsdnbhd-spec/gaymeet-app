import { api } from './client';

/** A note in MY inbox — ANONYMOUS. The backend never sends sender identity. */
export interface InboxNote {
  _id: string;
  body: string;
  createdAt: string;
  replyBody?: string | null;
  repliedAt?: string | null;
  read: boolean;
}

/** A note I SENT — the recipient I chose is identified. */
export interface SentNote {
  _id: string;
  body: string;
  createdAt: string;
  replyBody?: string | null;
  repliedAt?: string | null;
  recipient: { _id: string; nickname: string; avatarUrl?: string | null };
}

export interface NoteQuota {
  used: number;
  limit: number;
  remaining: number;
  isPremium: boolean;
}

function unwrap<T>(p: Promise<{ data: { data?: T } & T }>): Promise<T> {
  return p.then((r) => {
    const body = r.data as any;
    return (body?.data ?? body) as T;
  });
}

/** Send an anonymous note. Throws on 429 (quota) — inspect
 *  `e.response.data.code === 'NOTE_QUOTA'` and `.isPremium` to branch the UI. */
export const sendNote = (recipientId: string, body: string) =>
  unwrap<{ _id: string; createdAt: string; remaining: number; limit: number }>(
    api.post('/notes', { recipientId, body }),
  );

export const getNotesQuota = () => unwrap<NoteQuota>(api.get('/notes/quota'));

export const getInbox = () =>
  unwrap<{ unreadCount: number; notes: InboxNote[] }>(api.get('/notes/inbox'));

export const getSentNotes = () =>
  unwrap<{ notes: SentNote[] }>(api.get('/notes/sent'));

export const getNotesUnread = () =>
  unwrap<{ count: number }>(api.get('/notes/unread'));

export const markNotesRead = () => api.post('/notes/read').catch(() => {});

export const replyNote = (id: string, body: string) =>
  unwrap<{ _id: string; replyBody: string; repliedAt: string }>(
    api.post(`/notes/${id}/reply`, { body }),
  );

export const deleteNote = (id: string) =>
  unwrap<{ ok: true }>(api.delete(`/notes/${id}`));

export const blockNoteSender = (id: string) =>
  unwrap<{ ok: true }>(api.post(`/notes/${id}/block`));
