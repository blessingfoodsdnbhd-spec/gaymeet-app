/**
 * Crash reporting (Sentry) — client. HIGH-B.
 *
 * Env-gated and dependency-soft so it's a complete no-op until explicitly
 * enabled — the current build is unaffected:
 *   - Disabled unless a DSN is present (app.json extra.sentryDsn).
 *   - Disabled in dev (__DEV__).
 *   - Soft-requires @sentry/react-native; if not installed, stays disabled and
 *     never throws.
 *
 * To ENABLE (requires a new build — native module):
 *   1. cd app-rn && npx expo install @sentry/react-native
 *   2. Add to app.json:  expo.extra.sentryDsn = "<your dsn>"
 *      and the "@sentry/react-native/expo" plugin to expo.plugins.
 *   3. Rebuild (EAS).
 */
import Constants from 'expo-constants';

let sentry: any = null;

export function initSentry(): void {
  const dsn =
    (Constants.expoConfig?.extra as any)?.sentryDsn ||
    (Constants.manifest as any)?.extra?.sentryDsn;
  if (!dsn) return;
  if (__DEV__) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Sentry = require('@sentry/react-native');
    Sentry.init({ dsn, debug: false });
    sentry = Sentry;
  } catch {
    // package not installed — see header to enable. No-op.
  }
}

export function captureException(e: unknown): void {
  if (!sentry) return;
  try {
    sentry.captureException(e);
  } catch {
    /* never let reporting crash the app */
  }
}
