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

/** Drop the on-disk isAdmin flag. MUST run on sign-out: the key is not
 *  user-scoped, so without this a previous admin's cached `true` would seed
 *  the admin UI gate for the next user who signs in — and it survives
 *  force-quit because it lives on disk, so clearing the in-memory query cache
 *  is not enough. Called by clearSessionCaches() in store/auth.ts. */
export async function clearCachedIsAdmin(): Promise<void> {
  try {
    await AsyncStorage.removeItem(IS_ADMIN_CACHE_KEY);
  } catch {
    // best-effort; ignore
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

// ── Reports dashboard (REPORT1) ──────────────────────────────────────────────

export interface AdminReport {
  id: string;
  kind: 'worldChat' | 'vote';
  reason: string;
  reporter: string;
  target: string;
  createdAt: string;
}

export async function getAdminReports(): Promise<{ reports: AdminReport[]; count: number }> {
  const r = await api.get('/admin/reports');
  return unwrap<{ reports: AdminReport[]; count: number }>(r.data);
}

export async function resolveReport(kind: string, id: string): Promise<void> {
  await api.post(`/admin/reports/${kind}/${id}/resolve`);
}

// ── Analytics dashboard (STATS1) ─────────────────────────────────────────────

export interface AdminStats {
  totalUsers: number;
  dau: number;
  mau: number;
  signupsToday: number;
  signups7d: number;
  signups30d: number;
  premiumCount: number;
  premiumPct: number;
  moments24h: number;
  totalMoments: number;
  totalVotes: number;
  totalMatches: number;
}

export async function getAdminStats(): Promise<AdminStats> {
  const r = await api.get('/admin/stats');
  return unwrap<AdminStats>(r.data);
}

// ── Photo/video verification review (VERIFY1) ────────────────────────────────

export interface AdminVerification {
  id: string;
  userId: string | null;
  nickname: string;
  avatarUrl?: string | null;
  pose: string;
  verificationType: 'photo' | 'video';
  selfieUrl?: string | null;
  videoUrl?: string | null;
  status: string;
  createdAt: string;
}

export async function getAdminVerifications(): Promise<{ verifications: AdminVerification[]; count: number }> {
  const r = await api.get('/admin/verifications');
  return unwrap<{ verifications: AdminVerification[]; count: number }>(r.data);
}

export async function approveVerification(id: string): Promise<void> {
  await api.post(`/admin/verifications/${id}/approve`);
}

export async function rejectVerification(id: string, reason?: string): Promise<void> {
  await api.post(`/admin/verifications/${id}/reject`, reason ? { reason } : {});
}

// ── User moderation (ADMIN1) ─────────────────────────────────────────────────

export interface AdminModUser {
  id: string;
  nickname: string;
  email: string;
  avatarUrl: string | null;
  photos: string[];
  privatePhotos: string[];
  isVerified: boolean;
  isOfficial: boolean;
  createdAt: string;
  isBanned: boolean;
  bannedAt: string | null;
  banReason: string | null;
  chatBanned: boolean;
  photoUploadBanned: boolean;
}

export interface AdminModMoment {
  id: string;
  content: string;
  images: string[];
  visibility: string;
  createdAt: string;
}

export interface AdminModVoteEntry {
  id: string;
  eventId: string | null;
  eventTitle: string;
  photoUrl: string;
  caption: string;
  voteCount: number;
  createdAt: string;
}

export interface AdminModView {
  user: AdminModUser;
  moments: AdminModMoment[];
  voteEntries: AdminModVoteEntry[];
}

export async function getAdminUserModeration(userId: string): Promise<AdminModView> {
  const r = await api.get(`/admin/users/${userId}`);
  return unwrap<AdminModView>(r.data);
}

export async function banUser(userId: string, reason?: string): Promise<void> {
  await api.post(`/admin/users/${userId}/ban`, reason ? { reason } : {});
}

export async function unbanUser(userId: string): Promise<void> {
  await api.post(`/admin/users/${userId}/unban`);
}

/** Toggle the chat-send capability ban. */
export async function setChatBan(userId: string, banned: boolean, reason?: string): Promise<void> {
  await api.post(`/admin/users/${userId}/${banned ? 'chat-ban' : 'chat-unban'}`, reason ? { reason } : {});
}

/** Toggle the photo-upload capability ban. */
export async function setPhotoBan(userId: string, banned: boolean, reason?: string): Promise<void> {
  await api.post(`/admin/users/${userId}/${banned ? 'photo-ban' : 'photo-unban'}`, reason ? { reason } : {});
}

export async function deleteUserPhoto(
  userId: string,
  url: string,
  kind: 'public' | 'private' | 'avatar',
): Promise<void> {
  await api.delete(`/admin/users/${userId}/photos`, { data: { url, kind } });
}

export async function deleteUserMoment(momentId: string): Promise<void> {
  await api.delete(`/admin/moments/${momentId}`);
}

/**
 * Reset EVERY user's passed/skipped Discover swipes so skipped profiles
 * reappear in the deck. Likes / super-likes (and Matches) are preserved.
 * Returns the number of swipe rows removed. Irreversible.
 */
export async function resetDiscoverAll(): Promise<number> {
  const r = await api.post('/admin/discover/reset-all');
  return unwrap<{ removed?: number }>(r.data)?.removed ?? 0;
}

/**
 * Reset a single user's passed/skipped Discover swipes (customer support).
 * Their Likes / Matches are preserved. Returns rows removed.
 */
export async function resetDiscoverUser(userId: string): Promise<number> {
  const r = await api.post(`/admin/discover/reset-user/${userId}`);
  return unwrap<{ removed?: number }>(r.data)?.removed ?? 0;
}

export async function deleteUserVoteEntry(entryId: string): Promise<void> {
  await api.delete(`/admin/vote-entries/${entryId}`);
}

export interface AdminAuditAction {
  id: string;
  action: string;
  admin: string;
  targetUser: string | null;
  targetType: string | null;
  targetId: string | null;
  reason: string;
  meta: Record<string, unknown>;
  createdAt: string;
}

export async function getAuditLog(
  targetUser?: string,
  limit = 100,
): Promise<{ actions: AdminAuditAction[]; count: number }> {
  const r = await api.get('/admin/audit-log', { params: { targetUser, limit } });
  return unwrap<{ actions: AdminAuditAction[]; count: number }>(r.data);
}
