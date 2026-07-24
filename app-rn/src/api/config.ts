import { api } from './client';

/** One platform's upgrade gate (see backend AppVersionConfig). */
export interface VersionGate {
  minimum: string;
  recommended: string;
  latest: string;
  storeUrl: string;
  message: string;
}
export interface VersionConfig {
  ios: VersionGate;
  android: VersionGate;
}

const EMPTY_GATE: VersionGate = {
  minimum: '0.0.0',
  recommended: '0.0.0',
  latest: '0.0.0',
  storeUrl: '',
  message: '',
};

function normalizeGate(x: any): VersionGate {
  if (!x || typeof x !== 'object') return { ...EMPTY_GATE };
  return {
    minimum: String(x.minimum ?? '0.0.0'),
    recommended: String(x.recommended ?? '0.0.0'),
    latest: String(x.latest ?? '0.0.0'),
    storeUrl: String(x.storeUrl ?? ''),
    message: String(x.message ?? ''),
  };
}

/**
 * GET /api/config/version — public app-version gate. Never throws a hard
 * failure into the caller's decision path; on any oddity it returns
 * never-blocking defaults so a backend hiccup can't lock users out.
 */
export const getVersionConfig = async (): Promise<VersionConfig> => {
  const r = await api.get('/config/version');
  const body = r.data as any;
  const inner = body?.data !== undefined ? body.data : body;
  return {
    ios: normalizeGate(inner?.ios),
    android: normalizeGate(inner?.android),
  };
};
