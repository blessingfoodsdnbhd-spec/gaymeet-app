import { api } from './client';

export type VoteCategory = 'photography' | 'outfit' | 'food' | 'travel' | 'talent' | 'pets';
export type VoteMode = 'one' | 'fivePerDay' | 'unlimited';
export type VoteStatus = 'pending' | 'active' | 'ended';
export type VoteType = 'single' | 'multiRound';
export type VoteEntryStatus = 'active' | 'eliminated' | 'winner1' | 'winner2' | 'winner3';

export interface VoteRound {
  index: number;
  startAt: string;
  endAt: string;
  advanceMode: 'percent' | 'fixed';
  advanceValue: number;
}

/** A ranked entry attached to a feed event for the swipeable card carousel. */
export interface FeedVoteEntry {
  entryId: string;
  photoUrl: string;
  submitter: { id: string; displayName: string; avatarUrl: string | null };
  voteCount: number;
  votedByMe: boolean;
  rank: number;
  tag: 'top1' | 'top2' | 'top3' | 'new' | 'resume';
}

/** Per-user read progress for an event's carousel (resume + new-entries badge). */
export interface VoteProgress {
  lastSeenEntryId: string | null;
  lastSeenIndex: number;
  unseenCount: number;
}

export interface VoteEventSummary {
  id: string;
  creatorId: string;
  creator?: { id: string; displayName: string; avatarUrl: string | null; isOfficial?: boolean };
  title: string;
  description: string;
  category: VoteCategory;
  coverPhotos: string[];
  referencePhotos: string[];
  externalLink: string | null;
  startAt: string;
  endAt: string;
  rules: { mode: VoteMode };
  type: VoteType;
  rounds: VoteRound[];
  currentRoundIndex: number;
  status: VoteStatus;
  entryCount: number;
  voteCount: number;
  topEntries: { entryId: string | null; rank: number }[];
  createdAt: string;
  // Attached by GET /votes (feed) only — absent on the detail event payload.
  entries?: FeedVoteEntry[];
  cover?: string | null;
  myProgress?: VoteProgress;
}

export interface VoteEntry {
  id: string;
  submitter: { id: string; displayName: string; avatarUrl: string | null };
  photoUrl: string;
  caption: string;
  voteCount: number;
  votedByMe: boolean;
  status: VoteEntryStatus;
  eliminatedAtRoundIndex: number | null;
}

export interface VoteEventDetail {
  event: VoteEventSummary;
  isCreator: boolean;
  myEntryId: string | null;
  entries: VoteEntry[];
}

export interface UserHighlight {
  id: string;
  eventId: string | null;
  eventTitle: string;
  entryPhotoUrl: string;
  rank: 1 | 2 | 3;
  endedAt: string;
}

function unwrap<T>(p: Promise<{ data: { data?: T } & T }>): Promise<T> {
  return p.then((r) => {
    const body = r.data as any;
    return (body?.data ?? body) as T;
  });
}

export interface ListVotesParams {
  status?: VoteStatus | 'all';
  category?: VoteCategory;
  scope?: 'all' | 'nearby' | 'following' | 'mine';
  limit?: number;
  before?: string;
}
export const listVoteEvents = (params: ListVotesParams = {}) =>
  unwrap<{ events: VoteEventSummary[] }>(api.get('/votes', { params }));

export const getVoteEvent = (id: string) =>
  unwrap<VoteEventDetail>(api.get(`/votes/${id}`));

// Simplified create form: category + title + description + the initiator's own
// entry photo. Cover/reference photos, external link, start/end dates, vote-rule
// and format are all server-defaults now (15-day window, single round, one vote
// per entry) and no longer client-supplied. The patch (edit) path reuses this
// shape via Partial — only title/description/category are editable.
export interface CreateVotePayload {
  title: string;
  description: string;
  category: VoteCategory;
  /** Initiator-as-contestant: the creator's own entry photo (required). */
  entryPhotoUrl: string;
}
export const createVoteEvent = (payload: CreateVotePayload) =>
  unwrap<VoteEventSummary>(api.post('/votes', payload));

export const updateVoteEvent = (id: string, patch: Partial<CreateVotePayload>) =>
  unwrap<VoteEventSummary>(api.patch(`/votes/${id}`, patch));

export const deleteVoteEvent = (id: string) =>
  unwrap<{ ok: true }>(api.delete(`/votes/${id}`));

export const submitVoteEntry = (id: string, body: { photoUrl: string; caption?: string }) =>
  unwrap<{ id: string }>(api.post(`/votes/${id}/entries`, body));

export const withdrawVoteEntry = (id: string) =>
  unwrap<{ ok: true }>(api.delete(`/votes/${id}/entries/me`));

/** Record the viewer's last-seen carousel position (debounced on swipe). */
export const saveVoteProgress = (id: string, entryId: string, index: number) =>
  unwrap<{ ok: true }>(api.post(`/votes/${id}/progress`, { entryId, index }));

export const castVote = (id: string, entryId: string) =>
  unwrap<{ ok: true }>(api.post(`/votes/${id}/entries/${entryId}/vote`));

export const retractVote = (id: string, entryId: string) =>
  unwrap<{ ok: true }>(api.delete(`/votes/${id}/entries/${entryId}/vote`));

export const reportVoteEvent = (id: string, reason?: string) =>
  api.post(`/votes/${id}/report`, { reason });

export const reportVoteEntry = (id: string, entryId: string, reason?: string) =>
  api.post(`/votes/${id}/entries/${entryId}/report`, { reason });

export const getUserHighlights = (userId: string) =>
  unwrap<{ highlights: UserHighlight[] }>(api.get(`/votes/users/${userId}/highlights`));

export interface VoteEventUpdate {
  id: string;
  body: string;
  photos: string[];
  createdAt: string;
}
export const getEventUpdates = (eventId: string, before?: string, limit = 20) =>
  unwrap<{ total: number; updates: VoteEventUpdate[] }>(
    api.get(`/votes/${eventId}/updates`, { params: { before, limit } }),
  );
export const postEventUpdate = (eventId: string, body: { body: string; photos?: string[] }) =>
  unwrap<VoteEventUpdate>(api.post(`/votes/${eventId}/updates`, body));
export const deleteEventUpdate = (eventId: string, updateId: string) =>
  unwrap<{ ok: true }>(api.delete(`/votes/${eventId}/updates/${updateId}`));
