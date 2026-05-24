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
 *
 * ── DIAGNOSTICS (build #12) ───────────────────────────────────────────────
 * Build #11 testing showed "no error, nothing happens" after the user taps
 * the Google button. The flow was returning null silently on the cancelled
 * path, so we couldn't tell whether (a) the user actually cancelled,
 * (b) the OAuth round-trip dismissed without a callback (URL scheme not
 * registered / Google Cloud iOS client missing bundle id), or (c) the
 * idToken came back null. This file now accumulates a step-by-step diag
 * trail and surfaces it via an Alert on EVERY exit path that isn't a clean
 * success. Strip the DIAG_ alerts once we've identified the failure mode.
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

/** Short suffix for an OAuth client id, safe to display (just the random part). */
function shortId(id: string | undefined): string {
  if (!id) return '∅';
  // 208538145733-ccuidhniu111ssc70ri9kjrdv6095obs.apps.googleusercontent.com
  //                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ this part is what changes
  const m = id.match(/-(\w+)\.apps/);
  return m ? m[1].slice(0, 8) + '…' : id.slice(0, 12);
}

async function ensureConfigured(diag: string[]): Promise<boolean> {
  if (configuredOk != null) {
    diag.push(`cfg cached=${configuredOk}`);
    return configuredOk;
  }
  const cfg = getConfig();
  diag.push(`cfg ready=${cfg.ready} ios=${shortId(cfg.iosClientId)} web=${shortId(cfg.webClientId)}`);
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
    diag.push('configure ok');
    return true;
  } catch (e: any) {
    diag.push(`configure threw: ${e?.message ?? String(e)}`);
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
 *
 *  Diagnostic side-effect: on any non-success exit, shows an Alert with
 *  the step trail. See file header. Remove once Google sign-in is stable.
 */
export async function signInWithGoogle(): Promise<GoogleSignInResult | null> {
  const diag: string[] = ['start'];

  const ok = await ensureConfigured(diag);
  if (!ok) {
    Alert.alert(
      i18n.t('googleSignIn.notReadyTitle'),
      i18n.t('googleSignIn.notReadyBody') + '\n\nDIAG: ' + diag.join(' → '),
    );
    return null;
  }

  try {
    const mod = await import('@react-native-google-signin/google-signin');
    const { GoogleSignin } = mod;

    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      diag.push('playServices ok');
    }

    // Clear any cached previous sign-in. Without this, a half-completed
    // earlier attempt can leave native state that blocks the next signIn().
    try {
      await GoogleSignin.signOut();
      diag.push('prev signOut ok');
    } catch (e: any) {
      diag.push(`prev signOut threw: ${e?.message ?? String(e)}`);
    }

    diag.push('calling signIn()');
    const result: any = await GoogleSignin.signIn();
    const resultKeys = result ? Object.keys(result).join(',') : 'null';
    const resultType = result?.type ?? 'undefined';
    diag.push(`signIn returned: type=${resultType} keys=[${resultKeys}]`);

    // v13+ wraps the payload in `{ type, data: {...} }`; older versions
    // return the fields at the top level. Handle both.
    const data = result?.data ?? result;
    let idToken: string | undefined =
      data?.idToken ??
      data?.tokens?.idToken ??
      result?.idToken;
    diag.push(`idToken from signIn: ${idToken ? `len=${idToken.length}` : 'null'}`);

    // Was this a genuine user cancel, or did the OAuth round-trip dismiss
    // without a callback? We can't tell perfectly, but if `type` is
    // 'cancelled' AND we never even got to call signIn() once before, it's
    // probably a real cancel. If it's cancelled but we expected a real
    // round-trip, surface it so we can diagnose. For build #12, ALWAYS
    // surface cancelled — it's the failure mode the user is hitting.
    if (resultType === 'cancelled' && !idToken) {
      Alert.alert(
        'Google sign-in cancelled / no callback',
        diag.join(' → ') +
          '\n\nIf you didn\'t tap Cancel, the OAuth redirect probably never came back into the app. Common causes:' +
          '\n• Google Cloud iOS OAuth client missing bundle id com.meetupnearby.app' +
          '\n• REVERSED_CLIENT_ID URL scheme not in the built Info.plist',
      );
      return null;
    }

    // signIn() can return User.idToken === null even on success in some
    // v13 configurations. Fall back to getTokens() which explicitly
    // fetches a fresh idToken from the native module.
    if (!idToken) {
      try {
        const tokens = await GoogleSignin.getTokens();
        idToken = tokens?.idToken;
        diag.push(`getTokens() idToken: ${idToken ? `len=${idToken.length}` : 'null'}`);
      } catch (e: any) {
        diag.push(`getTokens threw: ${e?.message ?? String(e)}`);
      }
    }

    if (!idToken) {
      const err = new Error('Google did not return an idToken');
      (err as any).userFriendlyMessage =
        i18n.t('googleSignIn.noIdToken') + '\n\nDIAG: ' + diag.join(' → ');
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
    diag.push(`caught: code=${e?.code ?? 'none'} msg=${e?.message ?? String(e)}`);

    if (
      e?.code === statusCodes?.SIGN_IN_CANCELLED ||
      e?.code === 'SIGN_IN_CANCELLED'
    ) {
      // Was silent before — surface for build #12 so we can confirm this
      // is what's happening.
      Alert.alert(
        'Google sign-in cancelled (status code)',
        diag.join(' → ') +
          '\n\nNative module reported SIGN_IN_CANCELLED. If you didn\'t cancel, check Google Cloud iOS OAuth client bundle id.',
      );
      return null;
    }
    if (e?.code === statusCodes?.IN_PROGRESS) {
      Alert.alert('Google sign-in already in progress', diag.join(' → '));
      return null;
    }
    if (!e.userFriendlyMessage) {
      e.userFriendlyMessage = (e?.code
        ? i18n.t('googleSignIn.loginFailedWithCode', { code: e.code })
        : i18n.t('googleSignIn.loginFailed')
      ) + '\n\nDIAG: ' + diag.join(' → ');
    }
    throw e;
  }
}

export function isGoogleConfigured() {
  return getConfig().ready;
}
