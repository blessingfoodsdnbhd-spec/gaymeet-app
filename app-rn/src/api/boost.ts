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
  /** Coins spent (0 for Premium users who boost free). */
  cost?: number;
  /** New coin balance after a paid boost. */
  balance?: number;
}

/** Activate a 30-minute Boost. Premium users boost free; everyone else pays
 *  50 coins (backend returns 402 "Insufficient coins" if short). If already
 *  active, backend returns an error — caller treats the local isBoosted/
 *  boostExpiresAt as authoritative and skips activation. */
export const activateBoost = () =>
  unwrap<BoostActivateResponse>(api.post('/users/boost'));
