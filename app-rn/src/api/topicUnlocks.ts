import { api } from './client';

export type TopicUnlockStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'revoked';

export interface TopicUnlock {
  id: string;
  ownerId: string;
  viewerId: string;
  status: TopicUnlockStatus;
  requestedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  revokedAt: string | null;
}

export interface IncomingUnlock extends TopicUnlock {
  viewer: {
    _id: string;
    nickname?: string;
    avatarUrl?: string | null;
    age?: number | null;
  } | null;
}

export interface OutgoingUnlock extends TopicUnlock {
  owner: {
    _id: string;
    nickname?: string;
    avatarUrl?: string | null;
    age?: number | null;
  } | null;
}

export interface ApprovedUnlock extends TopicUnlock {
  role: 'owner' | 'viewer';
  other: {
    _id: string;
    nickname?: string;
    avatarUrl?: string | null;
    age?: number | null;
  } | null;
}

function unwrap<T>(p: Promise<{ data: { data?: T } & T }>): Promise<T> {
  return p.then((r) => {
    const body = r.data as any;
    return (body?.data ?? body) as T;
  });
}

export const requestUnlock = (ownerId: string) =>
  unwrap<TopicUnlock>(api.post('/topic-unlocks/request', { ownerId }));

export const approveUnlock = (id: string) =>
  unwrap<TopicUnlock>(api.post(`/topic-unlocks/${id}/approve`));

export const rejectUnlock = (id: string) =>
  unwrap<TopicUnlock>(api.post(`/topic-unlocks/${id}/reject`));

export const revokeUnlock = (id: string) =>
  unwrap<TopicUnlock>(api.post(`/topic-unlocks/${id}/revoke`));

export const getIncomingUnlocks = () =>
  unwrap<IncomingUnlock[]>(api.get('/topic-unlocks/incoming'));

export const getOutgoingUnlocks = () =>
  unwrap<OutgoingUnlock[]>(api.get('/topic-unlocks/outgoing'));

export const getApprovedUnlocks = () =>
  unwrap<ApprovedUnlock[]>(api.get('/topic-unlocks/approved'));
