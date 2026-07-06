import { api } from './client';
import type { User } from './me';

/** Server returns access + refresh tokens; client persists both. */
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

/** Server wraps payloads as { success: true, data: ... } via utils/respond.
 *  We unwrap to the inner payload for ergonomics. */
function unwrap<T>(p: Promise<{ data: { data?: T } & T }>): Promise<T> {
  return p.then((r) => {
    const body = r.data as any;
    return (body?.data ?? body) as T;
  });
}

/**
 * Auth endpoints need a longer timeout + spaced auto-retries. The backend
 * runs on Render's free tier, which sleeps after ~15 min of inactivity
 * and takes 30-50s to cold-start. The global axios timeout is 30s, which
 * is enough for warm requests but trips during cold spin-ups — the user
 * then sees the alert as a bare "Network Error" with no HTTP status,
 * because the request aborted before any response headers arrived.
 *
 * 60s per attempt covers the worst observed Render cold-start. We make up
 * to AUTH_MAX_ATTEMPTS tries, spaced by AUTH_RETRY_GAP_MS: the first attempt
 * usually wakes the dyno, and a later one then completes in ~1s. The gap
 * gives the dyno time to finish booting instead of hammering it.
 *
 * `onWaking` fires once, the moment we detect the first transient failure,
 * so the UI can show a "server is waking up…" hint while we keep retrying.
 *
 * Distinguish "network error" (ECONNABORTED / no .response) from real
 * HTTP error responses — only the former should retry. If the server
 * returned a 4xx/5xx, retrying would just hit the same error.
 */
const AUTH_TIMEOUT_MS = 60_000;
const AUTH_MAX_ATTEMPTS = 3;
const AUTH_RETRY_GAP_MS = 2_500;

interface PostAuthOpts {
  /** Called once when the first transient (cold-start) failure is detected. */
  onWaking?: () => void;
}

function isTransientNetworkError(err: any): boolean {
  if (!err) return false;
  if (err.response) return false; // server replied; not a network error
  const code = err.code as string | undefined;
  const msg = String(err.message ?? '');
  return (
    code === 'ECONNABORTED' ||
    code === 'ERR_NETWORK' ||
    code === 'ETIMEDOUT' ||
    /Network Error|timeout/i.test(msg)
  );
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function postAuth<T>(path: string, body: unknown, opts?: PostAuthOpts): Promise<T> {
  let lastErr: any;
  let notifiedWaking = false;
  for (let attempt = 0; attempt < AUTH_MAX_ATTEMPTS; attempt++) {
    try {
      const r = await api.post(path, body, { timeout: AUTH_TIMEOUT_MS });
      const rb = r.data as any;
      return (rb?.data ?? rb) as T;
    } catch (e: any) {
      // A real HTTP error (4xx/5xx) won't improve on retry — surface it now.
      if (!isTransientNetworkError(e)) throw e;
      lastErr = e;
      // First transient failure → tell the UI the dyno is likely cold-starting.
      if (!notifiedWaking) {
        notifiedWaking = true;
        opts?.onWaking?.();
      }
      if (attempt < AUTH_MAX_ATTEMPTS - 1) await sleep(AUTH_RETRY_GAP_MS);
    }
  }
  // All attempts exhausted on transient errors — surface a clearer message
  // than the bare "Network Error" axios produces.
  const wrapped: any = new Error(
    'Could not reach the server — it may be waking up. Please try again in a few seconds.',
  );
  wrapped.cause = lastErr;
  wrapped.code = lastErr?.code;
  wrapped.isAuthNetworkError = true;
  throw wrapped;
}

// `devCode` is returned by the backend ONLY while no real email provider is
// configured (temporary fallback so login works). It is undefined once a real
// MAIL_PROVIDER is set. The OTP screen auto-fills it when present.
export const sendOtp = (email: string) =>
  postAuth<{ success: true; devCode?: string }>('/auth/send-otp', { email });

export const verifyOtp = (email: string, code: string, inviteCode?: string) =>
  postAuth<AuthResponse>('/auth/verify-otp', { email, code, inviteCode: inviteCode || undefined });

// ── Email + password auth (vc128) ───────────────────────────────────────────
// Register requires an OTP the user already received via sendOtp() — this proves
// email ownership before a password is set. Login uses a single ambiguous error
// server-side (anti-enumeration). OTP login (sendOtp/verifyOtp) is kept as a
// fallback path reachable from the login screen.
export const registerWithPassword = (
  email: string,
  password: string,
  otpCode: string,
  inviteCode?: string,
  opts?: PostAuthOpts,
) =>
  postAuth<AuthResponse>(
    '/auth/register-with-password',
    { email, password, otpCode, inviteCode: inviteCode || undefined },
    opts,
  );

export const loginWithPassword = (email: string, password: string, opts?: PostAuthOpts) =>
  postAuth<AuthResponse>('/auth/login-with-password', { email, password }, opts);

// Forgot-password reuses the existing server endpoints. sendResetCode emails a
// reset code (always resolves, even for unknown emails — anti-enumeration);
// resetPassword sets the new password (the client then logs in with it).
export const sendResetCode = (email: string) =>
  postAuth<{ success: true }>('/auth/forgot-password', { email });

export const resetPassword = (email: string, code: string, newPassword: string) =>
  postAuth<{ success: true }>('/auth/reset-password', { email, code, newPassword });

export const signInApple = (identityToken: string, name?: string, opts?: PostAuthOpts) =>
  postAuth<AuthResponse>('/auth/apple', { identityToken, name }, opts);

export const signInGoogle = (idToken: string, opts?: PostAuthOpts) =>
  postAuth<AuthResponse>('/auth/google', { idToken }, opts);

export const refresh = (refreshToken: string) =>
  unwrap<{ accessToken: string; refreshToken: string }>(
    api.post('/auth/refresh', { refreshToken }),
  );
