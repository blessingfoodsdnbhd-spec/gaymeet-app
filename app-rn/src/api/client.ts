import axios, { type AxiosRequestConfig } from 'axios';
import Constants from 'expo-constants';
import { getAccessToken, getRefreshToken, setTokens, expireSession } from '../store/auth';
import { showToast } from '../utils/toastBridge';
import i18n from '../i18n';

const baseURL =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  'https://gaymeet-api.onrender.com';

// All backend routes are namespaced under /api on the Express server.
const apiBase = baseURL.replace(/\/+$/, '') + '/api';

// Default timeout covers the common case (~95% of calls finish in well
// under 5s). Render's free tier cold-starts can take 30-50s though, so we
// give some headroom. Upload endpoints (multipart, slow B2 round-trip)
// override per-call via the second axios arg — see api/upload.ts.
export const api = axios.create({
  baseURL: apiBase,
  timeout: 30000,
});

api.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Single in-flight refresh promise — multiple parallel 401s should all wait
// on the same refresh round-trip, not fire N separate ones.
let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const refresh = await getRefreshToken();
    if (!refresh) return null;
    try {
      const res = await axios.post(`${apiBase}/auth/refresh`, {
        refreshToken: refresh,
      });
      const body = res.data as any;
      const data = body?.data ?? body;
      const access = data?.accessToken as string | undefined;
      const newRefresh = (data?.refreshToken as string | undefined) ?? refresh;
      if (!access) return null;
      await setTokens(access, newRefresh);
      return access;
    } catch {
      // Refresh itself failed — wipe credentials so RootNavigator routes back
      // to Welcome. We do NOT throw; the original request error is what the
      // caller should see.
      await setTokens(null, null);
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const cfg = err?.config as (AxiosRequestConfig & { _retried?: boolean }) | undefined;
    // Auth endpoints (login / OTP / refresh) legitimately return 401 (wrong
    // code, etc.) — those must surface to the caller, NOT trigger a logout.
    const isAuthCall = (cfg?.url || '').includes('/auth/');

    if (err?.response?.status === 401 && cfg && !cfg._retried && !isAuthCall) {
      cfg._retried = true;
      const newAccess = await refreshAccessToken();
      if (newAccess) {
        cfg.headers = { ...(cfg.headers ?? {}), Authorization: `Bearer ${newAccess}` };
        return api.request(cfg);
      }
      // Refresh failed → the session is truly expired. Clean logout (no API
      // calls → no recursion), a friendly toast, and SWALLOW the error so no
      // screen pops a scary "Invalid or expired token" alert. RootNavigator
      // reacts to user=null and routes back to Welcome; the global toast
      // survives the navigation.
      await expireSession();
      showToast(i18n.t('auth.sessionExpired'), 'error');
      return new Promise(() => {}); // never settles — downstream handlers no-op
    }

    // Anti-spam responses (429 rate-limit / duplicate, 403 account-too-young,
    // signup IP cap). The backend tags these with a `code`; surface a friendly
    // toast centrally so every screen gets it for free. We still reject so the
    // caller's loading state resets.
    const data = err?.response?.data as
      | { code?: string; retryAfter?: number; waitHours?: number }
      | undefined;
    switch (data?.code) {
      case 'RATE_LIMITED':
        showToast(i18n.t('errors.rateLimited', { retryAfter: data.retryAfter ?? 0 }), 'error');
        break;
      case 'DUPLICATE_MESSAGE':
        showToast(i18n.t('errors.duplicateMessage'), 'error');
        break;
      case 'ACCOUNT_TOO_YOUNG':
        showToast(i18n.t('errors.accountTooYoung', { waitHours: data.waitHours ?? 0 }), 'error');
        break;
      case 'TOO_MANY_SIGNUPS_FROM_IP':
        showToast(i18n.t('errors.tooManySignups'), 'error');
        break;
    }
    return Promise.reject(err);
  },
);
