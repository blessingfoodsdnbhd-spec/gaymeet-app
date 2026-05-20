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

export const sendOtp = (email: string) =>
  unwrap<{ success: true }>(api.post('/auth/send-otp', { email }));

export const verifyOtp = (email: string, code: string) =>
  unwrap<AuthResponse>(api.post('/auth/verify-otp', { email, code }));

export const signInApple = (identityToken: string, name?: string) =>
  unwrap<AuthResponse>(api.post('/auth/apple', { identityToken, name }));

export const signInGoogle = (idToken: string) =>
  unwrap<AuthResponse>(api.post('/auth/google', { idToken }));

export const refresh = (refreshToken: string) =>
  unwrap<{ accessToken: string; refreshToken: string }>(api.post('/auth/refresh', { refreshToken }));
