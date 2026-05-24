import { Platform } from 'react-native';
import i18n from '../i18n';
import { verifyAppleReceipt, IAP_SKUS } from '../api/subscription';

/**
 * Purchase a subscription via the device's IAP store.
 *
 * Requires `react-native-iap` to be installed AND configured in
 * App Store Connect with matching SKUs (see `IAP_SKUS`). The native
 * module is lazy-imported so Expo Go and development builds without
 * IAP support get a clear error rather than a startup crash.
 *
 * Returns the backend's updated isPremium / premiumExpiresAt on success.
 * Returns null on user cancellation.
 */
export async function purchaseSubscription(sku: string): Promise<{
  isPremium: boolean;
  premiumExpiresAt: string | null;
} | null> {
  const t = (k: string, p?: Record<string, unknown>) => i18n.t(k, p);

  // Android requires Google Play setup — skip for now.
  if (Platform.OS !== 'ios') {
    throw new Error(t('iapError.iosOnly'));
  }

  let RNIap: any;
  try {
    RNIap = await import('react-native-iap');
  } catch {
    throw new Error(t('iapError.moduleMissing'));
  }

  try {
    await RNIap.initConnection();
  } catch (e: any) {
    throw new Error(t('iapError.initFailed', { detail: e?.message ?? e }));
  }

  let products: any[];
  try {
    products = await RNIap.getSubscriptions({ skus: [sku] });
  } catch (e: any) {
    throw new Error(t('iapError.fetchFailed', { detail: e?.message ?? e }));
  }
  if (!products || products.length === 0) {
    throw new Error(t('iapError.skuMissing'));
  }

  let purchase: any;
  try {
    purchase = await RNIap.requestSubscription({ sku });
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (/cancel|user closed/i.test(msg)) return null;
    throw new Error(t('iapError.purchaseFailed', { detail: msg }));
  }
  if (!purchase) return null;

  // iOS 7+ exposes the raw receipt via getReceiptIOS()
  let receipt: string | undefined = purchase.transactionReceipt;
  if (!receipt && RNIap.getReceiptIOS) {
    receipt = await RNIap.getReceiptIOS();
  }
  if (!receipt) {
    throw new Error(t('iapError.receiptMissing'));
  }

  // Hand off to backend for verification — Apple-validated receipts are the
  // source of truth for activating Premium on the User document.
  const result = await verifyAppleReceipt(receipt, sku);

  // Acknowledge the purchase so iOS doesn't keep replaying it on next launch.
  try {
    await RNIap.finishTransaction({ purchase, isConsumable: false });
  } catch {
    // best effort
  }

  return result;
}

/**
 * Restore an existing Premium subscription on a new device / after a
 * reinstall. Apple guideline 3.1.1 requires every IAP-using app expose
 * a Restore button — submission will be rejected otherwise.
 *
 *   - Calls native RNIap.getAvailablePurchases() to surface any
 *     previously-purchased entitlement still active for this Apple ID.
 *   - For each restored receipt matching one of our SKUs, replays it
 *     through the backend's /verify-apple-receipt endpoint so the
 *     server re-grants premium and returns the updated state.
 *   - Returns the activated isPremium/premiumExpiresAt OR null if
 *     nothing restorable was found.
 *   - On a native-module error (no IAP support, etc.) throws with a
 *     userFriendlyMessage; the caller surfaces an Alert.
 */
export async function restoreSubscriptions(): Promise<{
  isPremium: boolean;
  premiumExpiresAt: string | null;
} | null> {
  const t = (k: string, p?: Record<string, unknown>) => i18n.t(k, p);

  if (Platform.OS !== 'ios') {
    throw new Error(t('iapError.iosOnly'));
  }

  let RNIap: any;
  try {
    RNIap = await import('react-native-iap');
  } catch {
    throw new Error(t('iapError.moduleMissing'));
  }

  try {
    await RNIap.initConnection();
  } catch (e: any) {
    throw new Error(t('iapError.initFailed', { detail: e?.message ?? e }));
  }

  let purchases: any[] = [];
  try {
    purchases = await RNIap.getAvailablePurchases();
  } catch (e: any) {
    throw new Error(t('iapError.restoreFailed', { detail: e?.message ?? e }));
  }

  // Filter to only our subscription SKUs — Apple may also return stale
  // consumables / unrelated entitlements.
  const ourSkus = new Set<string>([IAP_SKUS.monthly, IAP_SKUS.annual]);
  const eligible = (purchases || []).filter((p: any) =>
    ourSkus.has(p?.productId),
  );
  if (eligible.length === 0) return null;

  // Walk newest-first and try each receipt with the backend until one
  // succeeds. The latest receipt usually covers the full history.
  eligible.sort(
    (a: any, b: any) =>
      Number(b.transactionDate ?? 0) - Number(a.transactionDate ?? 0),
  );

  let activated: { isPremium: boolean; premiumExpiresAt: string | null } | null = null;
  let lastErr: any = null;
  for (const p of eligible) {
    const receipt: string | undefined =
      p?.transactionReceipt ??
      (RNIap.getReceiptIOS ? await RNIap.getReceiptIOS() : undefined);
    if (!receipt) {
      lastErr = new Error('no receipt on purchase');
      continue;
    }
    try {
      const res = await verifyAppleReceipt(receipt, p.productId);
      if (res?.isPremium) {
        activated = res;
        break;
      }
    } catch (e: any) {
      lastErr = e;
    }
  }

  if (!activated && lastErr) {
    throw new Error(
      t('iapError.restoreFailed', {
        detail: lastErr?.message ?? String(lastErr),
      }),
    );
  }
  return activated;
}
