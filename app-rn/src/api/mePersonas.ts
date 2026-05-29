import { api } from './client';

/**
 * MY topic personas — managed via /api/me/topic-personas. Shapes mirror
 * the backend: `id` + `topicSlug` + `nickname` + `photos[]` + `isActive`.
 */
export interface MyPersona {
  id: string;
  topicSlug: string;
  nickname: string;
  photos: string[];
  isActive: boolean;
  updatedAt: string | null;
}

export interface PersonaUpsertInput {
  topicSlug: string;
  nickname: string;
  photos: string[];
}

export interface PersonaPatch {
  nickname?: string;
  photos?: string[];
  isActive?: boolean;
}

function unwrap<T>(p: Promise<{ data: { data?: T } & T }>): Promise<T> {
  return p.then((r) => {
    const body = r.data as any;
    return (body?.data ?? body) as T;
  });
}

export const getMyPersonas = () =>
  unwrap<MyPersona[]>(api.get('/me/topic-personas'));

export const createOrUpsertPersona = (input: PersonaUpsertInput) =>
  unwrap<MyPersona>(api.post('/me/topic-personas', input));

export const updatePersona = (topicSlug: string, patch: PersonaPatch) =>
  unwrap<MyPersona>(
    api.patch(`/me/topic-personas/${encodeURIComponent(topicSlug)}`, patch),
  );

export const deletePersona = (topicSlug: string) =>
  unwrap<MyPersona>(
    api.delete(`/me/topic-personas/${encodeURIComponent(topicSlug)}`),
  );
