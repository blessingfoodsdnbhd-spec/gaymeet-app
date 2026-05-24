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

/**
 * Google Play subscription product structure.
 *
 * Apple uses one product per duration; Play uses ONE subscription ID with
 * multiple base plans. So we have:
 *   Subscription ID: com.meetupnearby.app.premium
 *   Base plans:      monthly (auto-renewing, 1 month, RM39.90)
 *                    annual  (auto-renewing, 1 year, RM399.90)
 *
 * The Play Console product must be created with EXACTLY these IDs for the
 * Android purchase + verify flow to succeed.
 */
export const ANDROID_IAP = {
  subscriptionId: 'com.meetupnearby.app.premium',
  basePlans: { monthly: 'monthly', annual: 'annual' },
} as const;

export const ANDROID_PACKAGE_NAME = 'com.meetupnearby.app';

/**
 * Map an Apple SKU → the matching Android base plan. The PremiumScreen
 * passes one of IAP_SKUS.{monthly,annual} and we route via the platform-
 * specific path internally; this keeps the UI layer platform-agnostic.
 */
export function basePlanForAppleSku(
  appleSku: string,
): 'monthly' | 'annual' | null {
  if (appleSku === IAP_SKUS.monthly) return ANDROID_IAP.basePlans.monthly;
  if (appleSku === IAP_SKUS.annual) return ANDROID_IAP.basePlans.annual;
  return null;
}

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

/**
 * Send a Google Play purchase token to the backend for verification +
 * Premium activation. Backend hits androidpublisher.purchases.subscriptionsv2
 * with a service-account credential, then grants premium on success.
 */
export const verifyGooglePurchase = (
  purchaseToken: string,
  productId: string,
  packageName: string = ANDROID_PACKAGE_NAME,
) =>
  unwrap<{ isPremium: boolean; premiumExpiresAt: string | null }>(
    api.post('/subscriptions/verify-google-purchase', {
      purchaseToken,
      productId,
      packageName,
    }),
  );
