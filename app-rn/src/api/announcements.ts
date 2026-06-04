import { api } from './client';

/**
 * Admin-managed announcement returned by GET /api/announcements/current.
 *
 * Backend filters by isActive + [startsAt, endsAt] window, so the client
 * gets either the single most-recent applicable announcement OR null
 * (meaning "no modal to show right now").
 */
export interface CurrentAnnouncement {
  id: string;
  imageUrl: string;
  ctaUrl?: string | null;
  title?: string | null;
}

function normalize(x: any): CurrentAnnouncement | null {
  if (!x || typeof x !== 'object' || !x.id || !x.imageUrl) return null;
  return {
    id: String(x.id),
    imageUrl: String(x.imageUrl),
    ctaUrl: x.ctaUrl ?? null,
    title: x.title ?? null,
  };
}

/**
 * All currently-active announcements (newest first). The backend now returns
 * an array; we still tolerate the old single-object/null shape for safety.
 */
export const getCurrentAnnouncements = async (): Promise<CurrentAnnouncement[]> => {
  const r = await api.get('/announcements/current');
  const body = r.data as any;
  const inner = body?.data !== undefined ? body.data : body;
  if (Array.isArray(inner)) {
    return inner.map(normalize).filter((a): a is CurrentAnnouncement => a != null);
  }
  const one = normalize(inner);
  return one ? [one] : [];
};
