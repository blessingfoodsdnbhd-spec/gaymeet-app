import { api } from './client';
import { queryClient } from './queryClient';

export type ReportReason =
  | 'inappropriate_photos'
  | 'harassment'
  | 'spam'
  | 'fake_profile'
  | 'underage'
  | 'other';

/**
 * @deprecated Use `t('report.reasons.<reason>')` instead. Kept for the
 * stable ReportReason union typing.
 */
export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  inappropriate_photos: 'Inappropriate photos',
  harassment: 'Harassment',
  spam: 'Spam',
  fake_profile: 'Fake profile',
  underage: 'Underage',
  other: 'Other',
};

function unwrap<T>(p: Promise<{ data: { data?: T } & T }>): Promise<T> {
  return p.then((r) => {
    const body = r.data as any;
    return (body?.data ?? body) as T;
  });
}

export const blockUser = (userId: string) =>
  unwrap<{}>(api.post(`/users/${userId}/block`));

/**
 * Invalidate every surface that should drop a freshly-blocked user, so they
 * disappear without a manual refresh. Call this right after a successful
 * blockUser() from any entry point (the backend is the source of truth — this
 * just refetches the now-filtered lists). Screen-specific cleanup (e.g.
 * nav.goBack()) stays in each caller's onBlocked.
 */
export function invalidateAfterBlock() {
  for (const key of [['discover'], ['moments'], ['chats', 'list'], ['search'], ['blockedUsers'], ['notifications']]) {
    queryClient.invalidateQueries({ queryKey: key });
  }
}

export const unblockUser = (userId: string) =>
  unwrap<{}>(api.delete(`/users/${userId}/block`));

export interface BlockedUser {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  isOfficial?: boolean;
  isVerified?: boolean;
}

/** List the users the current account has blocked. */
export const getBlockedUsers = () =>
  api.get('/users/me/blocked').then((r) => ((r.data?.data ?? r.data)?.blocked ?? []) as BlockedUser[]);

/** Block + log a report. Server auto-blocks on report (see backend blocks.js). */
export const reportUser = (userId: string, reason: ReportReason, detail?: string) =>
  unwrap<{}>(api.post(`/users/${userId}/report`, { reason, detail }));
