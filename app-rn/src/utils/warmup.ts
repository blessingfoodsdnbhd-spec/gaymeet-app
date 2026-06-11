import Constants from 'expo-constants';

/**
 * Backend warm-up helpers for Render's free tier, which sleeps the dyno after
 * ~15 min of inactivity and takes 30-50s to cold-start. We hit the lightweight
 * unauthenticated `/health` endpoint (no axios, no auth headers, no
 * interceptors) purely to spin the dyno back up before the user's first real
 * action (Apple/Google/email sign-in).
 *
 * Pairs with the timeout + multi-retry hardening in api/auth.ts — together they
 * make a cold start nearly invisible at the login screen.
 */

function healthUrl(): string {
  const baseURL =
    (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
    'https://gaymeet-api.onrender.com';
  return `${baseURL.replace(/\/+$/, '')}/health`;
}

/** One ping with its own abort timeout. Resolves true on a 2xx, false on any
 *  failure (network error, abort, non-2xx). Never throws. */
async function pingOnce(timeoutMs: number): Promise<boolean> {
  const controller = new AbortController();
  const cancel = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(healthUrl(), { signal: controller.signal });
    return r.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(cancel);
  }
}

/**
 * Fire-and-forget single warm ping. Used at app boot, during the splash window.
 * Non-blocking: callers never await it.
 */
export function wakeBackend(): void {
  void pingOnce(30_000);
}

/**
 * Keep pinging `/health` until the dyno answers, or until `attempts` is
 * exhausted, spacing failed attempts by `gapMs`. Safe to fire-and-forget — it
 * never throws and resolves `true` once the backend is up, `false` if it never
 * came up within the budget.
 *
 * Used on the login screen so the dyno keeps warming while the user reads the
 * welcome copy — a single boot ping can abort before a fully-cold dyno wakes,
 * so we follow up with a few spaced retries here.
 */
export async function warmBackend(attempts = 6, gapMs = 3_000): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    if (await pingOnce(15_000)) return true;
    if (i < attempts - 1) {
      await new Promise<void>((resolve) => setTimeout(resolve, gapMs));
    }
  }
  return false;
}
