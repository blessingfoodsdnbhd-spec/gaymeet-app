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

export const getCurrentAnnouncement = async (): Promise<CurrentAnnouncement | null> => {
  const r = await api.get('/announcements/current');
  const body = r.data as any;
  const inner = body?.data !== undefined ? body.data : body;
  if (!inner || typeof inner !== 'object') return null;
  if (!inner.id || !inner.imageUrl) return null;
  return {
    id: String(inner.id),
    imageUrl: String(inner.imageUrl),
    ctaUrl: inner.ctaUrl ?? null,
    title: inner.title ?? null,
  };
};
