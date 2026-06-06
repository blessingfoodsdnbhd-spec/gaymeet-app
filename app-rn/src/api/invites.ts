import { api } from './client';
import type { User } from './me';

function unwrap<T>(p: Promise<{ data: { data?: T } & T }>): Promise<T> {
  return p.then((r) => {
    const body = r.data as any;
    return (body?.data ?? body) as T;
  });
}

export interface InviteCodeInfo {
  code: string;
  usedCount: number;
  link: string;
}

export interface InviteStats {
  invitedCount: number;
  recentInvitees: { id: string; displayName: string; avatarUrl: string | null; redeemedAt: string }[];
}

/** The caller's invite code (auto-generated on first call). */
export const getMyInviteCode = () => unwrap<InviteCodeInfo>(api.get('/invites/me/code'));

export const getInviteStats = () => unwrap<InviteStats>(api.get('/invites/me/stats'));

/** Redeem someone else's code. Rejects with err.response.data.code = one of
 *  'invalidCode' | 'cantUseSelf' | 'alreadyRedeemed' on 400. */
export const redeemInvite = (code: string) =>
  unwrap<{ success: true; user: User }>(api.post('/invites/redeem', { code }));
