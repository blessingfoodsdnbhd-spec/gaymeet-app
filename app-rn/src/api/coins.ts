import { api } from './client';

function unwrap<T>(p: Promise<{ data: { data?: T } & T }>): Promise<T> {
  return p.then((r) => {
    const body = r.data as any;
    return (body?.data ?? body) as T;
  });
}

export interface CoinPackage {
  id: string;
  coins: number;
  bonus: number;
  price: number;
  currency: string;
  label: string;
  bestValue: boolean;
  popular: boolean;
}

/** Current coin balance. */
export const getCoinBalance = () =>
  unwrap<{ balance: number }>(api.get('/coins/balance'));

/** Purchasable coin packs. */
export const getCoinPackages = () => unwrap<CoinPackage[]>(api.get('/coins/packages'));

/** Mock purchase (no receipt verification yet — RevenueCat later). Credits
 *  coins + bonus immediately and returns the new balance. */
export const purchaseCoins = (packageId: string) =>
  unwrap<{ success: true; purchased: number; newBalance: number; package: CoinPackage }>(
    api.post('/coins/purchase', { package: packageId }),
  );

/** Claim the one-time profile-completion coin bonus. Idempotent server-side. */
export const claimProfileReward = () =>
  unwrap<{ granted: number; balance: number; alreadyClaimed?: boolean }>(
    api.post('/coins/claim-profile'),
  );
