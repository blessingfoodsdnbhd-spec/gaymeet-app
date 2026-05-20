/**
 * Google Sign-In helper.
 *
 * The native module ships with `@react-native-google-signin/google-signin`.
 * Because it's a native module, it does NOT work in Expo Go — you need an
 * EAS dev build (or a release build) on a real device or simulator with
 * Google Play Services / Apple OAuth configured.
 *
 * Configuration is read from `app.json → expo.extra`:
 *  - `googleWebClientId` — OAuth Web client ID (used as audience the backend verifies)
 *  - `googleIosClientId` — OAuth iOS client ID (only required on iOS)
 *
 * Until those values are filled in, `signInWithGoogle()` returns null and
 * surfaces a friendly alert telling the user the feature isn't enabled yet.
 */
import { Alert, Platform } from 'react-native';
import Constants from 'expo-constants';

let configured = false;
let configuredOk: boolean | null = null;

function getConfig() {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
  const webClientId = typeof extra.googleWebClientId === 'string'
    ? extra.googleWebClientId.trim()
    : '';
  const iosClientId = typeof extra.googleIosClientId === 'string'
    ? extra.googleIosClientId.trim()
    : '';
  const isPlaceholder = (v: string) =>
    !v || v === 'REPLACE_ME' || v.startsWith('REPLACE_');
  return {
    webClientId,
    iosClientId,
    ready: !isPlaceholder(webClientId) && (Platform.OS !== 'ios' || !isPlaceholder(iosClientId)),
  };
}

async function ensureConfigured(): Promise<boolean> {
  if (configuredOk != null) return configuredOk;
  const cfg = getConfig();
  if (!cfg.ready) {
    configuredOk = false;
    return false;
  }
  try {
    const mod = await import('@react-native-google-signin/google-signin');
    const { GoogleSignin } = mod;
    GoogleSignin.configure({
      webClientId: cfg.webClientId,
      iosClientId: Platform.OS === 'ios' ? cfg.iosClientId : undefined,
      offlineAccess: false,
    });
    configured = true;
    configuredOk = true;
    return true;
  } catch (e) {
    console.warn('GoogleSignin configure failed', e);
    configuredOk = false;
    return false;
  }
}

export interface GoogleSignInResult {
  idToken: string;
  email?: string | null;
  name?: string | null;
}

/**
 * Trigger the native Google Sign-In flow.
 *  - returns the user's idToken on success (caller POSTs to /api/auth/google)
 *  - returns null if the user cancels OR config isn't ready
 *  - throws with `.userFriendlyMessage` on real errors
 */
export async function signInWithGoogle(): Promise<GoogleSignInResult | null> {
  const ok = await ensureConfigured();
  if (!ok) {
    Alert.alert(
      'Google 登录暂未开通',
      '管理员还没有配置 OAuth 凭证。请用邮箱或 Apple 登录,或稍后再试。',
    );
    return null;
  }

  try {
    const mod = await import('@react-native-google-signin/google-signin');
    const { GoogleSignin, statusCodes } = mod;

    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }

    const result: any = await GoogleSignin.signIn();
    console.warn('GoogleSignin.signIn() result keys:', JSON.stringify(Object.keys(result ?? {})));
    console.warn('GoogleSignin.signIn() result.type:', result?.type);

    const data = result?.data ?? result;
    const idToken: string | undefined =
      data?.idToken ??
      data?.tokens?.idToken ??
      result?.idToken;

    if (result?.type === 'cancelled' && !idToken) {
      return null; // genuine user cancel
    }

    if (!idToken) {
      // Throw so onGoogle's catch surfaces an Alert. Include the raw shape
      // in the message so we can see it on-device without Metro logs.
      const dump = safeStringify(result);
      console.warn('Google no idToken — full result:', dump);
      const err = new Error('Google did not return an idToken');
      (err as any).userFriendlyMessage =
        `Google 没拿到 idToken。\n返回:${dump.slice(0, 200)}`;
      throw err;
    }
    return {
      idToken,
      email: data?.user?.email ?? null,
      name: data?.user?.name ?? null,
    };
  } catch (e: any) {
    const mod = await import('@react-native-google-signin/google-signin');
    const { statusCodes } = mod;
    if (
      e?.code === statusCodes?.SIGN_IN_CANCELLED ||
      e?.code === 'SIGN_IN_CANCELLED'
    ) {
      return null; // user dismissed the picker — stay silent
    }
    if (e?.code === statusCodes?.IN_PROGRESS) {
      return null;
    }
    if (!e.userFriendlyMessage) {
      e.userFriendlyMessage = '登录失败,稍后再试';
    }
    throw e;
  }
}

export function isGoogleConfigured() {
  return getConfig().ready;
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v, (_k, val) =>
      typeof val === 'string' && val.length > 200 ? `${val.slice(0, 200)}…` : val,
    );
  } catch {
    return String(v);
  }
}
