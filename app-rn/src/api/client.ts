import axios from 'axios';
import Constants from 'expo-constants';
import { getAccessToken } from '../store/auth';

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

api.interceptors.response.use(
  (r) => r,
  (err) => {
    // 401 anywhere → bubble up; the auth store listener wipes tokens and routes
    // back to Welcome (see store/auth.ts).
    return Promise.reject(err);
  },
);
