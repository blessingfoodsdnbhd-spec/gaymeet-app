import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { registerToken, unregisterToken } from '../api/notifications';

/**
 * Request push permission, fetch the native device token, register it with
 * the backend. Safe to call on every app boot — server upserts.
 *
 * Returns the registered token, or `null` if permission was denied or the
 * device can't receive pushes (simulator, etc.).
 *
 * Notes
 *  - We use `getDevicePushTokenAsync()` not `getExpoPushTokenAsync()` because
 *    the backend ships notifications via FCM/APNs directly (see backend
 *    services) — Expo's push service would be a needless extra hop.
 *  - Permission flow is deliberately silent on denial; we don't want to
 *    spam the user with system prompts. Settings → Notifications will
 *    offer to re-ask later (TODO).
 */
export async function registerPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null; // simulators can't receive push

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== 'granted') return null;

  // On iOS we need to set up the notification channel for Android too.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  try {
    const { data: token } = await Notifications.getDevicePushTokenAsync();
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
}
