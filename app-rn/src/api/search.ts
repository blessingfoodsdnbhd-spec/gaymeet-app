import { api } from './client';

export interface SearchUser {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  isOfficial?: boolean;
  isVerified?: boolean;
  isPremium?: boolean;
}
export interface SearchVote {
  id: string;
  title: string;
  status?: string;
  category?: string;
}
export interface SearchRoom {
  id: string;
  title: string;
  memberCount: number;
}
export interface SearchResults {
  users: SearchUser[];
  votes: SearchVote[];
  rooms: SearchRoom[];
}

export type SearchType = 'all' | 'users' | 'votes' | 'rooms';

/** Unified search across users / vote events / chat rooms (SEARCH1). */
export const search = (q: string, type: SearchType = 'all') =>
  api
    .get('/search', { params: { q, type } })
    .then((r) => ((r.data?.data ?? r.data) as SearchResults));
