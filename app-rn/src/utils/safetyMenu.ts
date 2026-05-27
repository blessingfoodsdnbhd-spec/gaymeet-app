import { ActionSheetIOS, Alert, Platform } from 'react-native';

import i18n from '../i18n';
import { blockUser } from '../api/safety';
import { useSafetyMenu, type SafetyMenuOptions } from '../store/safetyMenu';

/**
 * Show the Block / Report (/ Unmatch) action sheet for a target user.
 *
 * iOS  → native ActionSheetIOS (system-styled, dismissable by tap-outside).
 * Android → delegates to the <SafetyMenuSheet/> component mounted at App
 * root. Previously used Alert.alert with 4 buttons, which on Android
 * silently dropped the Cancel button and offered no way to dismiss —
 * users got stuck. The Modal-based sheet supports tap-outside, hardware
 * back, and an always-visible Cancel.
 */
export function showSafetyMenu(options: SafetyMenuOptions) {
  if (Platform.OS === 'android') {
    useSafetyMenu.getState().open(options);
    return;
  }

  // iOS — native action sheet path
  const t = (k: string, p?: Record<string, unknown>) => i18n.t(k, p);
  const { userId, userName, nav, onBlocked, includeUnmatch, onUnmatch } = options;

  const labels: string[] = [t('safetyMenu.report'), t('safetyMenu.block')];
  if (includeUnmatch) labels.push(t('safetyMenu.unmatch'));
  labels.push(t('safetyMenu.cancel'));
  const cancelIndex = labels.length - 1;
  const destructiveIndices = [1];
  if (includeUnmatch) destructiveIndices.push(2);

  ActionSheetIOS.showActionSheetWithOptions(
    {
      options: labels,
      cancelButtonIndex: cancelIndex,
      destructiveButtonIndex: destructiveIndices,
      userInterfaceStyle: 'light',
    },
    (idx) => {
      if (idx === 0) {
        nav.navigate('Report', { userId, userName });
        return;
      }
      if (idx === 1) {
        Alert.alert(
          t('safetyMenu.blockConfirmTitle', { name: userName }),
          t('safetyMenu.blockConfirmBody'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('safetyMenu.blockAction'),
              style: 'destructive',
              onPress: async () => {
                try {
                  await blockUser(userId);
                  onBlocked?.();
                } catch (e: any) {
                  const status = e?.response?.status;
                  const detail =
                    e?.response?.data?.error ||
                    e?.response?.data?.message ||
                    e?.message ||
                    'unknown';
                  Alert.alert(
                    t('safetyMenu.blockFailed'),
                    `${detail}${status ? ` (HTTP ${status})` : ''}`,
                  );
                }
              },
            },
          ],
        );
        return;
      }
      if (includeUnmatch && idx === 2) {
        Alert.alert(
          t('safetyMenu.unmatchConfirmTitle', { name: userName }),
          t('safetyMenu.unmatchConfirmBody'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('safetyMenu.unmatchAction'), style: 'destructive', onPress: () => onUnmatch?.() },
          ],
        );
      }
    },
  );
}
