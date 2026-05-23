import axios, { type AxiosRequestConfig } from 'axios';
import Constants from 'expo-constants';
import { getAccessToken, getRefreshToken, setTokens } from '../store/auth';

const baseURL =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  'https://gaymeet-api.onrender.com';

// All backend routes are namespaced under /api on the Express server.
const apiBase = baseURL.replace(/\/+$/, '') + '/api';

export const api = axios.create({
  baseURL: apiBase,
  timeout: 15000,
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
    if (err?.response?.status === 401 && cfg && !cfg._retried) {
      cfg._retried = true;
      const newAccess = await refreshAccessToken();
      if (newAccess) {
        cfg.headers = { ...(cfg.headers ?? {}), Authorization: `Bearer ${newAccess}` };
        return api.request(cfg);
      }
    }
    return Promise.reject(err);
  },
);
