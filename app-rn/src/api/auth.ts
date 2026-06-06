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
 * Auth endpoints need a longer timeout + a single auto-retry. The backend
 * runs on Render's free tier, which sleeps after ~15 min of inactivity
 * and takes 30-50s to cold-start. The global axios timeout is 30s, which
 * is enough for warm requests but trips during cold spin-ups — the user
 * then sees the alert as a bare "Network Error" with no HTTP status,
 * because the request aborted before any response headers arrived.
 *
 * 60s covers the worst observed Render cold-start. The retry covers the
 * tail case where the first attempt itself wakes the dyno: by the time we
 * retry, the backend is up and responds in ~1s.
 *
 * Distinguish "network error" (ECONNABORTED / no .response) from real
 * HTTP error responses — only the former should retry. If the server
 * returned a 4xx/5xx, the retry would just hit the same error.
 */
const AUTH_TIMEOUT_MS = 60_000;

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

async function postAuth<T>(path: string, body: unknown): Promise<T> {
  try {
    const r = await api.post(path, body, { timeout: AUTH_TIMEOUT_MS });
    const rb = r.data as any;
    return (rb?.data ?? rb) as T;
  } catch (e) {
    if (!isTransientNetworkError(e)) throw e;
    // One retry. Render cold-start usually wakes within the first attempt;
    // the retry then completes quickly. If it still fails, surface a
    // clearer error than the bare "Network Error" axios produces.
    try {
      const r = await api.post(path, body, { timeout: AUTH_TIMEOUT_MS });
      const rb = r.data as any;
      return (rb?.data ?? rb) as T;
    } catch (e2: any) {
      if (isTransientNetworkError(e2)) {
        const wrapped: any = new Error(
          'Could not reach the server — it may be waking up. Please try again in a few seconds.',
        );
        wrapped.cause = e2;
        wrapped.code = e2.code;
        wrapped.isAuthNetworkError = true;
        throw wrapped;
      }
      throw e2;
    }
  }
}

// `devCode` is returned by the backend ONLY while no real email provider is
// configured (temporary fallback so login works). It is undefined once a real
// MAIL_PROVIDER is set. The OTP screen auto-fills it when present.
export const sendOtp = (email: string) =>
  postAuth<{ success: true; devCode?: string }>('/auth/send-otp', { email });

export const verifyOtp = (email: string, code: string, inviteCode?: string) =>
  postAuth<AuthResponse>('/auth/verify-otp', { email, code, inviteCode: inviteCode || undefined });

export const signInApple = (identityToken: string, name?: string) =>
  postAuth<AuthResponse>('/auth/apple', { identityToken, name });

export const signInGoogle = (idToken: string) =>
  postAuth<AuthResponse>('/auth/google', { idToken });

export const refresh = (refreshToken: string) =>
  unwrap<{ accessToken: string; refreshToken: string }>(
    api.post('/auth/refresh', { refreshToken }),
  );
