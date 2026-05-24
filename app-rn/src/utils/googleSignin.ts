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
import i18n from '../i18n';

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
      i18n.t('googleSignIn.notReadyTitle'),
      i18n.t('googleSignIn.notReadyBody'),
    );
    return null;
  }

  try {
    const mod = await import('@react-native-google-signin/google-signin');
    const { GoogleSignin } = mod;

    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }

    // Clear any cached previous sign-in. Without this, a half-completed
    // earlier attempt can leave native state that blocks the next signIn()
    // with an opaque "in progress" or stale-token error.
    try {
      await GoogleSignin.signOut();
    } catch {
      // best-effort
    }

    const result: any = await GoogleSignin.signIn();

    // v13+ wraps the payload in `{ type, data: {...} }`; older versions
    // return the fields at the top level. Handle both.
    const data = result?.data ?? result;
    let idToken: string | undefined =
      data?.idToken ??
      data?.tokens?.idToken ??
      result?.idToken;

    if (result?.type === 'cancelled' && !idToken) {
      return null; // genuine user cancel
    }

    // signIn() can return User.idToken === null even on success in some
    // v13 configurations (e.g. when webClientId/iOS client config doesn't
    // line up). Fall back to getTokens() which explicitly fetches a fresh
    // idToken from the native module.
    if (!idToken) {
      try {
        const tokens = await GoogleSignin.getTokens();
        idToken = tokens?.idToken;
      } catch {
        // ignore — handled by the !idToken throw below
      }
    }

    if (!idToken) {
      const err = new Error('Google did not return an idToken');
      (err as any).userFriendlyMessage = i18n.t('googleSignIn.noIdToken');
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
      // Include the native error code if present — it's a small string
      // like "SIGN_IN_REQUIRED" / "DEVELOPER_ERROR" / "PLAY_SERVICES_NOT_AVAILABLE"
      // that tells us *what* failed on the device without needing logs.
      e.userFriendlyMessage = e?.code
        ? i18n.t('googleSignIn.loginFailedWithCode', { code: e.code })
        : i18n.t('googleSignIn.loginFailed');
    }
    throw e;
  }
}

export function isGoogleConfigured() {
  return getConfig().ready;
}

