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
  lastActiveAt: string | null;
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
  bio: string | null;
  lastActiveAt: string | null;
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
