import { ActionSheetIOS, Alert, type AlertButton, Keyboard, Platform } from 'react-native';

import i18n from '../i18n';
import { blockUser, invalidateAfterBlock } from '../api/safety';
import { type SafetyMenuOptions } from '../store/safetyMenu';

const t = (k: string, p?: Record<string, unknown>) => i18n.t(k, p);

/** Block confirm — shared by both platforms. */
function confirmBlock(
  userId: string,
  userName: string,
  onBlocked?: () => void,
) {
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
            invalidateAfterBlock();
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
}

/** Unmatch confirm — shared by both platforms. */
function confirmUnmatch(userName: string, onUnmatch?: () => void) {
  Alert.alert(
    t('safetyMenu.unmatchConfirmTitle', { name: userName }),
    t('safetyMenu.unmatchConfirmBody'),
    [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('safetyMenu.unmatchAction'), style: 'destructive', onPress: () => onUnmatch?.() },
    ],
  );
}

/**
 * Show the Block / Report (/ Unmatch) action sheet for a target user.
 *
 * iOS     → native ActionSheetIOS (system-styled, dismissable by tap-outside).
 * Android → native Alert.alert (Build 71). It previously delegated to the
 * Modal-based <SafetyMenuSheet/> mounted at App root, but under API 35 forced
 * edge-to-edge that Modal could mount off-screen / fail to render ("点了没反应"
 * on the chat-detail header ⋯ button — Build 70). Native Alert.alert is
 * immune to the edge-to-edge / keyboard fly-to-top class of bugs and is what
 * the rest of the app (e.g. ChatsList ✕-delete) already relies on. Android
 * Alert shows at most three buttons, so when an Unmatch entry is present the
 * explicit Cancel is dropped in favour of the dismissable (cancelable) backdrop
 * + hardware back.
 */
export function showSafetyMenu(options: SafetyMenuOptions) {
  // Drop any live keyboard first — this menu is fired from chat / profile /
  // comment surfaces that may still have a focused composer. Harmless on iOS.
  Keyboard.dismiss();

  const { userId, userName, nav, onBlocked, includeUnmatch, onUnmatch } = options;

  if (Platform.OS === 'android') {
    const buttons: AlertButton[] = [
      {
        text: t('safetyMenu.report'),
        onPress: () => nav.navigate('Report', { userId, userName }),
      },
      {
        text: t('safetyMenu.block'),
        style: 'destructive',
        onPress: () => confirmBlock(userId, userName, onBlocked),
      },
    ];
    if (includeUnmatch) {
      // 3rd (and final, per Android's 3-button cap) action; Cancel = backdrop.
      buttons.push({
        text: t('safetyMenu.unmatch'),
        style: 'destructive',
        onPress: () => confirmUnmatch(userName, onUnmatch),
      });
    } else {
      buttons.push({ text: t('safetyMenu.cancel'), style: 'cancel' });
    }
    Alert.alert(userName, undefined, buttons, { cancelable: true });
    return;
  }

  // iOS — native action sheet path
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
        confirmBlock(userId, userName, onBlocked);
        return;
      }
      if (includeUnmatch && idx === 2) {
        confirmUnmatch(userName, onUnmatch);
      }
    },
  );
}
