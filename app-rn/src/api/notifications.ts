import { api } from './client';

function unwrap<T>(p: Promise<{ data: { data?: T } & T }>): Promise<T> {
  return p.then((r) => {
    const body = r.data as any;
    return (body?.data ?? body) as T;
  });
}

/** Register the device's FCM/APNs push token with the backend. */
export const registerToken = (token: string) =>
  unwrap<{ success: true }>(api.post('/notifications/token', { token }));

/** Wipe the server-side token (on sign-out). */
export const unregisterToken = () =>
  unwrap<{ success: true }>(api.delete('/notifications/token'));
