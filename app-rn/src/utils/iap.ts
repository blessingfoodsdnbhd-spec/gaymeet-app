import { Platform } from 'react-native';
import i18n from '../i18n';
import {
  verifyAppleReceipt,
  verifyGooglePurchase,
  IAP_SKUS,
  ANDROID_IAP,
  ANDROID_PACKAGE_NAME,
  basePlanForAppleSku,
} from '../api/subscription';

type PremiumResult = {
  isPremium: boolean;
  premiumExpiresAt: string | null;
};

const tx = (k: string, p?: Record<string, unknown>) => i18n.t(k, p);

// react-native-iap 15.x (Nitro) — loaded lazily so the module never crashes
// Expo Go / web where the native module is absent. The whole surface below is
// typed `any`: we intentionally avoid importing the package's named types at
// module scope so the import stays dynamic.
async function loadRNIap(): Promise<any> {
  try {
    return await import('react-native-iap');
  } catch {
    throw new Error(tx('iapError.moduleMissing'));
  }
}

async function safeInit(RNIap: any) {
  try {
    await RNIap.initConnection();
  } catch (e: any) {
    throw new Error(tx('iapError.initFailed', { detail: e?.message ?? e }));
  }
}

// ─── Event-based purchase → Promise bridge ───────────────────────────────────
// v15's `requestPurchase` no longer resolves with the purchase; the result
// arrives asynchronously on `purchaseUpdatedListener` (success) or
// `purchaseErrorListener` (failure/cancel). This helper re-collapses that back
// into a single awaitable so the exported functions keep their old shape.
//
// `expectedIds` filters out unrelated / stale purchases (e.g. a leftover
// unfinished transaction the store replays on connect) so we only resolve with
// the SKU the caller actually asked to buy.
// Resolves `null` on user cancellation, rejects on any real error.
function isCancel(e: any): boolean {
  const code = e?.code;
  const msg = String(e?.message ?? e ?? '');
  return code === 'user-cancelled' || /cancel|user closed/i.test(msg);
}

function awaitPurchase(
  RNIap: any,
  expectedIds: string[],
  trigger: () => Promise<any>,
): Promise<any | null> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let updSub: any;
    let errSub: any;
    let timer: any;

    const cleanup = () => {
      settled = true;
      try { updSub?.remove?.(); } catch { /* noop */ }
      try { errSub?.remove?.(); } catch { /* noop */ }
      if (timer) clearTimeout(timer);
    };

    const matches = (p: any): boolean => {
      if (!p) return false;
      if (expectedIds.includes(p.productId)) return true;
      const ids: string[] = Array.isArray(p.ids) ? p.ids : [];
      return ids.some((i) => expectedIds.includes(i));
    };

    updSub = RNIap.purchaseUpdatedListener((purchase: any) => {
      if (settled || !matches(purchase)) return;
      cleanup();
      resolve(purchase);
    });

    errSub = RNIap.purchaseErrorListener((err: any) => {
      if (settled) return;
      cleanup();
      if (isCancel(err)) return resolve(null);
      reject(new Error(String(err?.message ?? 'purchase failed')));
    });

    // Safety net — never leave the caller hanging if neither event fires.
    timer = setTimeout(() => {
      if (settled) return;
      cleanup();
      reject(new Error(tx('iapError.purchaseFailed', { detail: 'timeout' })));
    }, 1000 * 60 * 5);

    // A synchronous rejection (bad params / not connected) also aborts.
    trigger().catch((e: any) => {
      if (settled) return;
      cleanup();
      if (isCancel(e)) return resolve(null);
      reject(new Error(String(e?.message ?? e)));
    });
  });
}

// ─── iOS purchase ────────────────────────────────────────────────────────────
async function purchaseIOS(sku: string, RNIap: any): Promise<PremiumResult | null> {
  let products: any[];
  try {
    products = await RNIap.fetchProducts({ skus: [sku], type: 'subs' });
  } catch (e: any) {
    throw new Error(tx('iapError.fetchFailed', { detail: e?.message ?? e }));
  }
  if (!products || products.length === 0) {
    throw new Error(tx('iapError.skuMissing'));
  }

  let purchase: any;
  try {
    purchase = await awaitPurchase(RNIap, [sku], () =>
      RNIap.requestPurchase({ type: 'subs', request: { apple: { sku } } }),
    );
  } catch (e: any) {
    throw new Error(tx('iapError.purchaseFailed', { detail: String(e?.message ?? e) }));
  }
  if (!purchase) return null;

  // v15 iOS (StoreKit 2) drops the per-purchase `transactionReceipt` field;
  // `getReceiptIOS()` still returns the base64 app receipt the backend verifies.
  let receipt: string | undefined = purchase.transactionReceipt;
  if (!receipt && RNIap.getReceiptIOS) {
    receipt = await RNIap.getReceiptIOS();
  }
  if (!receipt) {
    throw new Error(tx('iapError.receiptMissing'));
  }

  const result = await verifyAppleReceipt(receipt, sku);

  try {
    await RNIap.finishTransaction({ purchase, isConsumable: false });
  } catch {
    // best effort
  }
  return result;
}

// ─── Android purchase ────────────────────────────────────────────────────────
// Play uses ONE subscription ID with multiple base plans; the caller still
// passes an Apple-style sku (monthly/annual), and we translate to the right
// base plan + look up its offerToken from subscriptionOfferDetailsAndroid.
async function purchaseAndroid(
  appleSku: string,
  RNIap: any,
): Promise<PremiumResult | null> {
  const wantedBasePlan = basePlanForAppleSku(appleSku);
  if (!wantedBasePlan) {
    throw new Error(tx('iapError.skuMissing'));
  }
  const subscriptionId = ANDROID_IAP.subscriptionId;

  let products: any[];
  try {
    products = await RNIap.fetchProducts({ skus: [subscriptionId], type: 'subs' });
  } catch (e: any) {
    throw new Error(tx('iapError.fetchFailed', { detail: e?.message ?? e }));
  }
  const product = (products || []).find(
    (p: any) => (p?.id ?? p?.productId) === subscriptionId,
  );
  if (!product) {
    throw new Error(tx('iapError.skuMissing'));
  }

  const offers =
    product.subscriptionOfferDetailsAndroid || product.subscriptionOfferDetails || [];
  const matchingOffer = offers.find((o: any) => o?.basePlanId === wantedBasePlan);
  if (!matchingOffer?.offerToken) {
    throw new Error(tx('iapError.skuMissing'));
  }

  let purchase: any;
  try {
    purchase = await awaitPurchase(RNIap, [subscriptionId], () =>
      RNIap.requestPurchase({
        type: 'subs',
        request: {
          google: {
            skus: [subscriptionId],
            subscriptionOffers: [
              { sku: subscriptionId, offerToken: matchingOffer.offerToken },
            ],
          },
        },
      }),
    );
  } catch (e: any) {
    throw new Error(tx('iapError.purchaseFailed', { detail: String(e?.message ?? e) }));
  }
  // Listener yields a single Purchase; keep the array guard for safety.
  const top = Array.isArray(purchase) ? purchase[0] : purchase;
  if (!top) return null;

  const purchaseToken: string | undefined = top.purchaseToken;
  const productId: string = top.productId || subscriptionId;
  if (!purchaseToken) {
    throw new Error(tx('iapError.receiptMissing'));
  }

  const result = await verifyGooglePurchase(
    purchaseToken,
    productId,
    ANDROID_PACKAGE_NAME,
  );

  // Acknowledge so Play doesn't auto-refund. Backend also acknowledges
  // (double-ack is idempotent on Play's side), but the native ack tells
  // RNIap to stop replaying the pending purchase.
  try {
    await RNIap.finishTransaction({ purchase: top, isConsumable: false });
  } catch {
    // best effort
  }
  return result;
}

/**
 * Purchase a subscription via the device's IAP store.
 *
 * Caller always passes an Apple-style SKU (`IAP_SKUS.monthly|annual`);
 * Android internally translates to the Play subscription + base plan.
 *
 * Returns the backend's updated isPremium / premiumExpiresAt on success.
 * Returns null on user cancellation.
 */
/**
 * Localized store prices — the EXACT strings Google Play / the App Store will
 * charge, already formatted with the user's local currency symbol (e.g.
 * "RM 39.90", "$9.99", "€9.99"). Returned so the Premium screen can display
 * the same number the purchase sheet will show — never a hardcoded RM value
 * that mismatches the real charge.
 *
 * Returns null for a plan if the store is unavailable (Expo Go / web /
 * not-logged-into-store) — the caller then falls back to the backend price.
 */
export type LocalizedPrices = {
  monthly: string | null;
  annual: string | null;
};

export async function getLocalizedPrices(): Promise<LocalizedPrices> {
  const empty: LocalizedPrices = { monthly: null, annual: null };
  let RNIap: any;
  try {
    RNIap = await loadRNIap();
    await RNIap.initConnection();
  } catch {
    return empty; // store not available — caller falls back
  }

  try {
    if (Platform.OS === 'ios') {
      // iOS: two separate products, each carries displayPrice.
      const products = await RNIap.fetchProducts({
        skus: [IAP_SKUS.monthly, IAP_SKUS.annual],
        type: 'subs',
      });
      const find = (sku: string) =>
        (products || []).find((p: any) => (p?.id ?? p?.productId) === sku);
      const fmt = (p: any) =>
        p?.displayPrice || p?.localizedPrice || null;
      return {
        monthly: fmt(find(IAP_SKUS.monthly)),
        annual: fmt(find(IAP_SKUS.annual)),
      };
    }

    // Android: ONE subscription with two base plans; the formatted price is
    // in each base plan's first pricing phase.
    const products = await RNIap.fetchProducts({
      skus: [ANDROID_IAP.subscriptionId],
      type: 'subs',
    });
    const product = (products || []).find(
      (p: any) => (p?.id ?? p?.productId) === ANDROID_IAP.subscriptionId,
    );
    const offers =
      product?.subscriptionOfferDetailsAndroid ||
      product?.subscriptionOfferDetails ||
      [];
    const priceForBasePlan = (basePlanId: string): string | null => {
      const offer = offers.find((o: any) => o?.basePlanId === basePlanId);
      const phases = offer?.pricingPhases?.pricingPhaseList || [];
      // Last phase = the recurring price (skip any intro/free phase).
      const phase = phases[phases.length - 1];
      return phase?.formattedPrice || null;
    };
    return {
      monthly: priceForBasePlan(ANDROID_IAP.basePlans.monthly),
      annual: priceForBasePlan(ANDROID_IAP.basePlans.annual),
    };
  } catch {
    return empty;
  }
}

export async function purchaseSubscription(sku: string): Promise<PremiumResult | null> {
  const RNIap = await loadRNIap();
  await safeInit(RNIap);
  if (Platform.OS === 'ios') return purchaseIOS(sku, RNIap);
  if (Platform.OS === 'android') return purchaseAndroid(sku, RNIap);
  throw new Error(tx('iapError.iosOnly'));
}

// ─── Restore: iOS ────────────────────────────────────────────────────────────
async function restoreIOS(RNIap: any): Promise<PremiumResult | null> {
  let purchases: any[] = [];
  try {
    purchases = await RNIap.getAvailablePurchases();
  } catch (e: any) {
    throw new Error(tx('iapError.restoreFailed', { detail: e?.message ?? e }));
  }
  const ourSkus = new Set<string>([IAP_SKUS.monthly, IAP_SKUS.annual]);
  const eligible = (purchases || []).filter((p: any) => ourSkus.has(p?.productId));
  if (eligible.length === 0) return null;

  eligible.sort(
    (a: any, b: any) =>
      Number(b.transactionDate ?? 0) - Number(a.transactionDate ?? 0),
  );

  let activated: PremiumResult | null = null;
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
      tx('iapError.restoreFailed', {
        detail: lastErr?.message ?? String(lastErr),
      }),
    );
  }
  return activated;
}

// ─── Restore: Android ────────────────────────────────────────────────────────
async function restoreAndroid(RNIap: any): Promise<PremiumResult | null> {
  let purchases: any[] = [];
  try {
    purchases = await RNIap.getAvailablePurchases();
  } catch (e: any) {
    throw new Error(tx('iapError.restoreFailed', { detail: e?.message ?? e }));
  }
  const eligible = (purchases || []).filter(
    (p: any) => p?.productId === ANDROID_IAP.subscriptionId,
  );
  if (eligible.length === 0) return null;

  // Most recent first — Play returns transactionDate as a string ISO or
  // a millis number depending on RNIap version.
  eligible.sort((a: any, b: any) => {
    const av = Number(a?.transactionDate ?? Date.parse(a?.transactionDate ?? '') ?? 0);
    const bv = Number(b?.transactionDate ?? Date.parse(b?.transactionDate ?? '') ?? 0);
    return bv - av;
  });

  let activated: PremiumResult | null = null;
  let lastErr: any = null;
  for (const p of eligible) {
    if (!p?.purchaseToken) {
      lastErr = new Error('no purchaseToken on purchase');
      continue;
    }
    try {
      const res = await verifyGooglePurchase(
        p.purchaseToken,
        p.productId || ANDROID_IAP.subscriptionId,
        ANDROID_PACKAGE_NAME,
      );
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
      tx('iapError.restoreFailed', {
        detail: lastErr?.message ?? String(lastErr),
      }),
    );
  }
  return activated;
}

/**
 * Restore an existing Premium subscription on a new device / after a
 * reinstall. Apple guideline 3.1.1 (and Play has a similar expectation)
 * requires every IAP-using app expose a Restore button.
 */
export async function restoreSubscriptions(): Promise<PremiumResult | null> {
  const RNIap = await loadRNIap();
  await safeInit(RNIap);
  if (Platform.OS === 'ios') return restoreIOS(RNIap);
  if (Platform.OS === 'android') return restoreAndroid(RNIap);
  throw new Error(tx('iapError.iosOnly'));
}
