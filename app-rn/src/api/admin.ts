import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './client';

/**
 * In-app admin API.
 *
 * Every call here goes out with the logged-in user's Bearer JWT (added by the
 * axios request interceptor). The backend's requireAdminAuth admits the
 * request iff that user's email is in the server's ADMIN_EMAILS allowlist —
 * so no X-Admin-Token is needed from the app.
 */

const unwrap = <T>(body: any): T => (body?.data !== undefined ? body.data : body);

// ── is-admin (with a small AsyncStorage cache) ───────────────────────────────

const IS_ADMIN_CACHE_KEY = 'meyou.isAdmin.v1';
const IS_ADMIN_TTL_MS = 24 * 60 * 60 * 1000; // 1 day

/** Last known isAdmin flag from disk, so the UI doesn't flash while the
 *  network query resolves. Returns null if absent or stale. */
export async function getCachedIsAdmin(): Promise<boolean | null> {
  try {
    const raw = await AsyncStorage.getItem(IS_ADMIN_CACHE_KEY);
    if (!raw) return null;
    const { value, at } = JSON.parse(raw) as { value: boolean; at: number };
    if (typeof value !== 'boolean' || typeof at !== 'number') return null;
    if (Date.now() - at > IS_ADMIN_TTL_MS) return null;
    return value;
  } catch {
    return null;
  }
}

async function setCachedIsAdmin(value: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(
      IS_ADMIN_CACHE_KEY,
      JSON.stringify({ value, at: Date.now() }),
    );
  } catch {
    // best-effort cache; ignore write failures
  }
}

/** Fetch the authoritative isAdmin flag and refresh the on-disk cache. */
export async function fetchIsAdmin(): Promise<boolean> {
  const r = await api.get('/me/is-admin');
  const data = unwrap<{ isAdmin?: boolean }>(r.data);
  const value = !!data?.isAdmin;
  await setCachedIsAdmin(value);
  return value;
}

// ── Announcement CRUD ────────────────────────────────────────────────────────

export interface AdminAnnouncement {
  _id: string;
  imageUrl: string;
  ctaUrl?: string | null;
  title?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AnnouncementInput {
  imageUrl: string;
  ctaUrl?: string | null;
  title?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
}

export async function listAnnouncements(): Promise<AdminAnnouncement[]> {
  const r = await api.get('/admin/announcements');
  return unwrap<AdminAnnouncement[]>(r.data) ?? [];
}

export async function createAnnouncement(
  input: AnnouncementInput,
): Promise<AdminAnnouncement> {
  const r = await api.post('/admin/announcements', input);
  return unwrap<AdminAnnouncement>(r.data);
}

export async function updateAnnouncement(
  id: string,
  patch: Partial<AnnouncementInput & { isActive: boolean }>,
): Promise<AdminAnnouncement> {
  const r = await api.patch(`/admin/announcements/${id}`, patch);
  return unwrap<AdminAnnouncement>(r.data);
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await api.delete(`/admin/announcements/${id}`);
}
