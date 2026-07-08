/**
 * Meyou 密友 — self-hosted OTA (Expo Updates) runtime glue.
 *
 * The heavy lifting is done natively by `expo-updates` per the app.json
 * `updates` config (checkAutomatically: ON_LOAD): on every cold start the
 * native layer fetches the newest JS bundle from updates.meyou.uk in the
 * background and applies it on the NEXT launch. This module just:
 *   • kicks an explicit check/fetch (so a fresh-open user still gets it),
 *   • logs status for debugging,
 *   • degrades to a complete no-op when the native module is absent
 *     (Expo Go, or a build made before expo-updates was added) — exactly
 *     like src/lib/sentry.ts, so current shipped builds are unaffected.
 *
 * We deliberately do NOT auto-reloadAsync mid-session: yanking the JS out
 * from under an active user is jarring. The update lands on next cold start.
 */

// Minimal surface of expo-updates we touch. Typed locally (not via
// `typeof import('expo-updates')`) so this file compiles even when the native
// package isn't installed yet — it's added to package.json but only pulled in
// by `npx expo install expo-updates` ahead of the next native build.
interface ExpoUpdates {
  isEnabled?: boolean;
  updateId?: string | null;
  checkForUpdateAsync(): Promise<{ isAvailable: boolean }>;
  fetchUpdateAsync(): Promise<unknown>;
}

// Defensive require: importing a missing native module would throw at load.
let Updates: ExpoUpdates | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  Updates = require('expo-updates') as ExpoUpdates;
} catch {
  Updates = null;
}

const TAG = '[ota]';

/** True only in a build where expo-updates is installed AND enabled. */
export function otaEnabled(): boolean {
  return !!Updates && Updates.isEnabled === true;
}

/**
 * Check for and download a newer JS bundle in the background. Safe to call
 * unconditionally at startup — it self-guards and never rejects.
 * Returns true if a new update was downloaded (will apply next cold start).
 */
export async function checkAndFetchUpdate(): Promise<boolean> {
  if (!otaEnabled() || !Updates) return false;
  try {
    const res = await Updates.checkForUpdateAsync();
    if (!res.isAvailable) {
      if (__DEV__) console.log(TAG, 'up to date');
      return false;
    }
    if (__DEV__) console.log(TAG, 'update available → fetching');
    await Updates.fetchUpdateAsync();
    if (__DEV__) console.log(TAG, 'fetched — applies on next cold start');
    return true;
  } catch (e) {
    // Network/server hiccup must never break app boot.
    if (__DEV__) console.log(TAG, 'check failed (non-fatal):', String(e));
    return false;
  }
}

/** The running update id (for support/debugging), or null when not on OTA. */
export function currentUpdateId(): string | null {
  if (!otaEnabled() || !Updates) return null;
  return Updates.updateId ?? null;
}
