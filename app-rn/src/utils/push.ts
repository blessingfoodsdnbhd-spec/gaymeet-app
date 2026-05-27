import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import messaging from '@react-native-firebase/messaging';
import { registerToken, unregisterToken } from '../api/notifications';
import { routeFromPushData, stashColdTap, type PushData } from './pushRouter';

/**
 * Request push permission, fetch the unified FCM token, register it with
 * the backend. Safe to call on every app boot — server upserts.
 *
 * Why @react-native-firebase/messaging (not expo-notifications native token)?
 *   - firebase-admin on the backend sends to FCM tokens only. iOS APNs
 *     tokens (what expo-notifications.getDevicePushTokenAsync returns on
 *     iOS) can't be passed to messaging().send({ token }).
 *   - @react-native-firebase/messaging exchanges APNs → FCM on iOS for us,
 *     and gives a raw FCM token on Android. Single token type → single
 *     backend send path.
 *
 * expo-notifications stays around for: notification *display* config
 * (setNotificationHandler, Android channel), since RNFirebase doesn't
 * auto-display incoming pushes when the app is foregrounded.
 */
export async function registerPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null; // simulators don't get push tokens

  // iOS: requestPermission shows the system prompt the first time, then
  // returns the cached status on subsequent calls.
  if (Platform.OS === 'ios') {
    const authStatus = await messaging().requestPermission();
    const granted =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;
    if (!granted) return null;
  } else {
    // Android: expo-notifications handles POST_NOTIFICATIONS (Android 13+).
    // On <13 it auto-grants.
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') return null;

    // Android needs the notification channel set up before pushes can show.
    // HIGH importance → heads-up banner + sound; matches iOS default UX.
    //
    // Channel ID is `default_v2` (not `default`) to force creation of a fresh
    // channel. Android caches channel settings — once a channel exists, you
    // CANNOT change its sound / vibration / importance for that ID; users
    // have to manually reset notification settings. Bumping the ID is the
    // only way to ship our custom sound to users who already had the app.
    // Keep the backend channelId in sync (utils/push.js android.notification
    // .channelId must match).
    await Notifications.setNotificationChannelAsync('default_v2', {
      name: 'default',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'notification_sound', // res/raw/notification_sound.wav (no ext)
    });
  }

  try {
    // FCM token: unified across iOS (via APNs exchange) and Android.
    const token = await messaging().getToken();
    if (!token) return null;
    await registerToken(token);
    return token;
  } catch {
    return null;
  }
}

export async function clearPushToken() {
  try {
    await unregisterToken();
  } catch {
    // best effort — sign-out should still succeed
  }
  // Also wipe the local FCM token so a fresh sign-in gets a new one.
  try {
    await messaging().deleteToken();
  } catch {
    /* ignore */
  }
}

// ── Notification display + tap handling ──────────────────────────────────────
// expo-notifications handler controls how a notification looks while the app
// is foregrounded. Without this, foreground pushes are silently dropped
// because RN's default is "don't interrupt the user".
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    // SDK 53+ split shouldShowAlert into banner + list flags; both kept on.
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Wire all the listeners that route taps + display foreground messages.
 * Call once at app boot from App.tsx. Returns a teardown function that
 * cleans up the subscriptions; safe to discard if app lives until process
 * exit.
 *
 * Listener matrix:
 *   - cold tap (app killed → user taps notif → app cold-launched):
 *     messaging().getInitialNotification() returns the RemoteMessage that
 *     caused the launch. We stash it; <NavigationContainer onReady> drains.
 *   - background tap (app backgrounded → user taps notif → app foregrounds):
 *     messaging().onNotificationOpenedApp fires; we navigate immediately.
 *   - foreground push (app already open):
 *     messaging().onMessage fires; we manually trigger a local notification
 *     via expo-notifications so the user actually sees it. (RNFirebase
 *     intentionally suppresses foreground display.)
 */
export function setupPushListeners(): () => void {
  // Cold tap — fire-and-forget; result stashed for drainColdTap() to replay.
  messaging()
    .getInitialNotification()
    .then((rm) => {
      if (rm?.data) stashColdTap(rm.data as PushData);
    })
    .catch(() => {});

  const offBackground = messaging().onNotificationOpenedApp((rm) => {
    if (rm?.data) routeFromPushData(rm.data as PushData);
  });

  const offForeground = messaging().onMessage(async (rm) => {
    const title =
      rm?.notification?.title ?? (rm?.data as any)?.title ?? '';
    const body = rm?.notification?.body ?? (rm?.data as any)?.body ?? '';
    if (!title && !body) return;
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: rm?.data ?? {},
          // Custom sound. iOS expects the filename (case-sensitive, with
          // extension) of a file bundled in the .ipa main bundle. Android
          // expects the res/raw resource name (no extension). The Expo
          // plugin withCustomNotificationSound.js puts the file in both
          // places at prebuild time.
          sound: Platform.OS === 'ios' ? 'notification_sound.caf' : 'notification_sound',
        },
        trigger: null, // immediate
      });
    } catch {
      /* ignore — best effort foreground display */
    }
  });

  // Foreground tap inside expo-notifications local-show path → also route.
  const tapSub = Notifications.addNotificationResponseReceivedListener(
    (resp) => {
      const data = resp.notification.request.content.data as PushData | undefined;
      if (data) routeFromPushData(data);
    },
  );

  return () => {
    try { offBackground(); } catch { /* ignore */ }
    try { offForeground(); } catch { /* ignore */ }
    try { tapSub.remove(); } catch { /* ignore */ }
  };
}

/**
 * Refresh-on-rotate: FCM tokens rotate occasionally. Subscribe to changes
 * so the backend always has the current token. Returns teardown.
 */
export function setupPushTokenRefresh(): () => void {
  const off = messaging().onTokenRefresh(async (token) => {
    if (!token) return;
    try {
      await registerToken(token);
    } catch {
      /* ignore — next boot's registerPushToken() will fix it */
    }
  });
  return off;
}
