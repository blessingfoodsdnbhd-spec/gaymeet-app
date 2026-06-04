import { api } from './client';

export interface Topic {
  slug: string;
  name: { en: string; zh: string };
  icon: string;
  order: number;
}

export interface TopicPersonaListItem {
  userId: string;
  nickname: string;
  photo0: string | null;
  photoCount: number;
  age: number | null;
  dob: string | null;
  lastActiveAt: string | null;
  // Backend pins the requester's own persona at the top of the first
  // page with this flag set — client renders a "ME / 你" badge and may
  // suppress unlock-request affordances on tap.
  isSelf?: boolean;
}

export interface TopicPersonaListPage {
  items: TopicPersonaListItem[];
  cursor: string | null;
}

export interface TopicPersonaDetail {
  userId: string;
  topicSlug: string;
  nickname: string;
  photos: string[];
  age: number | null;
  dob: string | null;
  bio: string | null;
  lastActiveAt: string | null;
  // True when the viewer is looking at their OWN persona — show an edit CTA
  // instead of the cross-topic unlock request. Set by the backend.
  isSelf?: boolean;
  // Only present when the viewer has an APPROVED TopicUnlock for this owner.
  mainProfile?: {
    nickname: string;
    avatarUrl: string | null;
    photos: string[];
    otherTopics: { topicSlug: string; nickname: string; photo0: string | null }[];
  };
}

function unwrap<T>(p: Promise<{ data: { data?: T } & T }>): Promise<T> {
  return p.then((r) => {
    const body = r.data as any;
    return (body?.data ?? body) as T;
  });
}

export const getTopics = () => unwrap<Topic[]>(api.get('/topics'));

export const getTopicPersonas = (slug: string, before?: string) =>
  unwrap<TopicPersonaListPage>(
    api.get(`/topics/${encodeURIComponent(slug)}/personas`, {
      params: before ? { before } : {},
    }),
  );

export const getTopicPersona = (slug: string, userId: string) =>
  unwrap<TopicPersonaDetail>(
    api.get(`/topics/${encodeURIComponent(slug)}/personas/${userId}`),
  );
