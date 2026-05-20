import { api } from './client';

export interface PricingTier {
  price: number;
  currency: string;
  period: 'month' | 'year';
}

export interface Pricing {
  monthly: PricingTier;
  annual: PricingTier;
}

/**
 * Apple App Store SKUs (must match App Store Connect products).
 *
 * Note: Apple does NOT allow reuse of product IDs — once a product is
 * created and deleted, that exact ID is permanently retired. The earlier
 * `.premium.monthly/annual` IDs were burned on a misplaced one-time IAP
 * creation, so we switched to the `.subscription.*` namespace.
 */
export const IAP_SKUS = {
  monthly: 'com.meetupnearby.app.subscription.monthly',
  annual: 'com.meetupnearby.app.subscription.annual',
} as const;

function unwrap<T>(p: Promise<{ data: { data?: T } & T }>): Promise<T> {
  return p.then((r) => {
    const body = r.data as any;
    return (body?.data ?? body) as T;
  });
}

export const getPricing = () => unwrap<Pricing>(api.get('/me/pricing'));

/**
 * Send an Apple IAP receipt to the backend for verification + Premium
 * activation. Backend returns the updated user (with isPremium /
 * premiumExpiresAt set).
 */
export const verifyAppleReceipt = (receipt: string, productId: string) =>
  unwrap<{ isPremium: boolean; premiumExpiresAt: string | null }>(
    api.post('/subscriptions/verify-apple-receipt', { receipt, productId }),
  );
