import { api } from './client';

export type ReportReason =
  | 'inappropriate_photos'
  | 'harassment'
  | 'spam'
  | 'fake_profile'
  | 'underage'
  | 'other';

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  inappropriate_photos: '不当照片',
  harassment: '骚扰行为',
  spam: '垃圾信息',
  fake_profile: '虚假资料',
  underage: '未成年',
  other: '其他',
};

function unwrap<T>(p: Promise<{ data: { data?: T } & T }>): Promise<T> {
  return p.then((r) => {
    const body = r.data as any;
    return (body?.data ?? body) as T;
  });
}

export const blockUser = (userId: string) =>
  unwrap<{}>(api.post(`/users/${userId}/block`));

export const unblockUser = (userId: string) =>
  unwrap<{}>(api.delete(`/users/${userId}/block`));

/** Block + log a report. Server auto-blocks on report (see backend blocks.js). */
export const reportUser = (userId: string, reason: ReportReason, detail?: string) =>
  unwrap<{}>(api.post(`/users/${userId}/report`, { reason, detail }));
