import React from 'react';
import {
  Modal,
  Pressable,
  View,
  Text,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useSafetyMenu } from '../store/safetyMenu';
import { useTheme } from '../theme/ThemeProvider';
import { blockUser, invalidateAfterBlock } from '../api/safety';
import { navigateAfterSheetClose } from '../utils/keyboardSheet';

/**
 * Android Safety menu sheet — replaces the broken Alert.alert(title, undefined,
 * [4 buttons]) approach that lost its Cancel button and couldn't be dismissed
 * by tapping outside.
 *
 * Mounted once at the App root. State is driven by useSafetyMenu (Zustand).
 * - Backdrop tap → close
 * - Android hardware back → close (via Modal.onRequestClose)
 * - Explicit Cancel button → close
 *
 * iOS continues to use the native ActionSheetIOS in utils/safetyMenu.ts —
 * better UX on iOS and this Modal sheet doesn't even render there.
 */
export function SafetyMenuSheet() {
  const { visible, options, close } = useSafetyMenu();
  const theme = useTheme();
  const { t } = useTranslation();

  if (!options) return null;

  const handleReport = () => {
    const { nav, userId, userName } = options;
    // This sheet is a RN <Modal> (Android-only). Closing it and pushing Report
    // in the same tick let Android drop the push mid-Dialog-teardown.
    navigateAfterSheetClose(close, () => nav.navigate('Report', { userId, userName }));
  };

  const handleBlock = () => {
    const { userId, userName, onBlocked } = options;
    close();
    // Two-step confirm — destructive action, mirrors iOS Alert flow.
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
  };

  const handleUnmatch = () => {
    const { userName, onUnmatch } = options;
    close();
    Alert.alert(
      t('safetyMenu.unmatchConfirmTitle', { name: userName }),
      t('safetyMenu.unmatchConfirmBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('safetyMenu.unmatchAction'), style: 'destructive', onPress: () => onUnmatch?.() },
      ],
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={close}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={close}>
        {/* Stop-prop so taps inside the sheet don't bubble + close it */}
        <Pressable onPress={() => {}}>
          <SafeAreaView edges={['bottom']} style={{ backgroundColor: theme.colors.surface }}>
            <View style={styles.sheet}>
              <Text style={[styles.title, { color: theme.colors.muted }]} numberOfLines={1}>
                {options.userName}
              </Text>

              <SheetButton
                label={t('safetyMenu.report')}
                onPress={handleReport}
                color={theme.colors.text}
              />
              <SheetDivider color={theme.colors.line} />
              <SheetButton
                label={t('safetyMenu.block')}
                onPress={handleBlock}
                color="#E5484D"
                bold
              />
              {options.includeUnmatch && (
                <>
                  <SheetDivider color={theme.colors.line} />
                  <SheetButton
                    label={t('safetyMenu.unmatch')}
                    onPress={handleUnmatch}
                    color="#E5484D"
                    bold
                  />
                </>
              )}
            </View>

            <View style={[styles.cancelWrap, { backgroundColor: theme.colors.bg }]}>
              <View
                style={[
                  styles.cancelBtnRow,
                  { backgroundColor: theme.colors.surface },
                ]}
              >
                <SheetButton
                  label={t('safetyMenu.cancel')}
                  onPress={close}
                  color={theme.colors.text}
                  bold
                />
              </View>
            </View>
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SheetButton({
  label,
  onPress,
  color,
  bold,
}: {
  label: string;
  onPress: () => void;
  color: string;
  bold?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
    >
      <Text style={{ color, fontSize: 16, fontWeight: bold ? '600' : '400' }}>
        {label}
      </Text>
    </Pressable>
  );
}

function SheetDivider({ color }: { color: string }) {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: color }} />;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    paddingTop: 4,
  },
  title: {
    textAlign: 'center',
    fontSize: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  btn: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  btnPressed: {
    opacity: 0.55,
  },
  cancelWrap: {
    paddingTop: 8,
  },
  cancelBtnRow: {
    // Visual separation from the action list above.
  },
});
