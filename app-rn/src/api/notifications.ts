import { api } from './client';

function unwrap<T>(p: Promise<{ data: { data?: T } & T }>): Promise<T> {
  return p.then((r) => {
    const body = r.data as any;
    return (body?.data ?? body) as T;
  });
}

/** Register the device's FCM/APNs push token with the backend.
 *  `skipAuthLogout`: this is a best-effort background call that can fire before
 *  the access token is stored (FCM onTokenRefresh at boot) — a 401 here must
 *  NOT log the user out. See the response interceptor in ./client. */
export const registerToken = (token: string) =>
  unwrap<{ success: true }>(
    api.post('/notifications/token', { token }, { skipAuthLogout: true } as any),
  );

/** Wipe the server-side token (on sign-out). */
export const unregisterToken = () =>
  unwrap<{ success: true }>(
    api.delete('/notifications/token', { skipAuthLogout: true } as any),
  );

// ── Notification Center (persisted records) ───────────────────────────────────

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, any>;
  read: boolean;
  createdAt: string;
}

export interface NotificationPrefs {
  disabled: string[];
  quietStartHour: number | null;
  quietEndHour: number | null;
  allTypes?: string[];
}

export const getNotifications = (before?: string) =>
  unwrap<{ notifications: AppNotification[] }>(
    api.get('/notifications/list', { params: { before, limit: 30 } }),
  );

export const getUnreadCount = () =>
  unwrap<{ count: number }>(api.get('/notifications/unread-count'));

export const markNotificationRead = (id: string) => api.post(`/notifications/${id}/read`);

export const markAllNotificationsRead = () => api.post('/notifications/read-all');

export const getNotificationPrefs = () =>
  unwrap<NotificationPrefs>(api.get('/notifications/preferences'));

export const updateNotificationPrefs = (patch: Partial<NotificationPrefs>) =>
  unwrap<NotificationPrefs>(api.patch('/notifications/preferences', patch));
