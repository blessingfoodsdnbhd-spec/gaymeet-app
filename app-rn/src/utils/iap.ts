import { Platform } from 'react-native';
import i18n from '../i18n';
import { verifyAppleReceipt } from '../api/subscription';

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
