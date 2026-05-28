import { api } from './client';

function unwrap<T>(p: Promise<{ data: { data?: T } & T }>): Promise<T> {
  return p.then((r) => {
    const body = r.data as any;
    return (body?.data ?? body) as T;
  });
}

export interface BoostActivateResponse {
  isBoosted: boolean;
  boostExpiresAt: string;
}

/** Activate a 30-minute Boost. Requires Premium server-side (403 if not).
 *  If already active, backend returns an error — caller should treat the
 *  current isBoosted/boostExpiresAt on the local user as authoritative
 *  and skip activation in that case. */
export const activateBoost = () =>
  unwrap<BoostActivateResponse>(api.post('/users/boost'));
