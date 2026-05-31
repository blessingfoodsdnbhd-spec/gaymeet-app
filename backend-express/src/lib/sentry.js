/**
 * Crash reporting (Sentry) — backend. HIGH-B.
 *
 * Env-gated and dependency-soft so it's a complete no-op until explicitly
 * enabled — the next deploy is unaffected:
 *   - Disabled unless SENTRY_DSN is set.
 *   - Disabled outside production (NODE_ENV !== 'production').
 *   - Soft-requires @sentry/node; if the package isn't installed, logs a hint
 *     and stays disabled (never throws).
 *
 * To ENABLE:
 *   1. cd backend-express && npm i @sentry/node
 *   2. Set env on Render:  SENTRY_DSN=<your dsn>   (NODE_ENV=production already)
 *   3. Redeploy.
 */

let sentry = null;

function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  if (process.env.NODE_ENV !== 'production') return;
  try {
    // eslint-disable-next-line global-require
    const Sentry = require('@sentry/node');
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0, // errors only; no perf tracing
    });
    sentry = Sentry;
    console.log('[sentry] backend crash reporting initialized');
  } catch (e) {
    console.warn(
      '[sentry] SENTRY_DSN set but @sentry/node not installed — crash ' +
        'reporting disabled. Run: cd backend-express && npm i @sentry/node'
    );
  }
}

function captureException(err) {
  if (!sentry) return;
  try {
    sentry.captureException(err);
  } catch (_) {
    /* never let reporting break the request */
  }
}

module.exports = { initSentry, captureException };
