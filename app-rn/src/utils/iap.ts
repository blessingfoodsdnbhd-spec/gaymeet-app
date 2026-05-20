import { Platform } from 'react-native';
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
  // Android requires Google Play setup — skip for now.
  if (Platform.OS !== 'ios') {
    throw new Error('Premium 暂只支持 iOS');
  }

  let RNIap: any;
  try {
    RNIap = await import('react-native-iap');
  } catch {
    throw new Error('IAP 模块未安装,需要 EAS dev build');
  }

  try {
    await RNIap.initConnection();
  } catch (e: any) {
    throw new Error(`IAP 初始化失败: ${e?.message ?? e}`);
  }

  let products: any[];
  try {
    products = await RNIap.getSubscriptions({ skus: [sku] });
  } catch (e: any) {
    throw new Error(`无法读取套餐: ${e?.message ?? e}`);
  }
  if (!products || products.length === 0) {
    throw new Error('App Store 找不到这个套餐,可能 SKU 未上架');
  }

  let purchase: any;
  try {
    purchase = await RNIap.requestSubscription({ sku });
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (/cancel|user closed/i.test(msg)) return null;
    throw new Error(`购买失败: ${msg}`);
  }
  if (!purchase) return null;

  // iOS 7+ exposes the raw receipt via getReceiptIOS()
  let receipt: string | undefined = purchase.transactionReceipt;
  if (!receipt && RNIap.getReceiptIOS) {
    receipt = await RNIap.getReceiptIOS();
  }
  if (!receipt) {
    throw new Error('拿不到 App Store receipt');
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
