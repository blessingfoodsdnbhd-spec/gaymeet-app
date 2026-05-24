import React, { useEffect, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme/ThemeProvider';
import { SettingsShell, SettingsCard, LinkRow, Divider } from './SettingsShell';

/**
 * Honest version: we don't yet have a server-side notification-preferences
 * API, so the previous per-category toggles silently lied. Show the user
 * what we actually know (system push status) and link straight to iOS
 * Settings if they want to change it.
 */
export function NotificationSettings() {
  const theme = useTheme();
  const { t } = useTranslation();
  const [status, setStatus] = useState<'granted' | 'denied' | 'undetermined' | 'unknown'>(
    'unknown',
  );

  const refresh = async () => {
    try {
      const perm = await Notifications.getPermissionsAsync();
      setStatus(
        perm.granted
          ? 'granted'
          : perm.status === 'undetermined'
          ? 'undetermined'
          : 'denied',
      );
    } catch {
      setStatus('unknown');
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const label =
    status === 'granted'
      ? t('notificationSettings.statusGranted')
      : status === 'denied'
      ? t('notificationSettings.statusDenied')
      : status === 'undetermined'
      ? t('notificationSettings.statusUndetermined')
      : t('notificationSettings.statusUnknown');

  return (
    <SettingsShell title={t('notificationSettings.title')}>
      <SettingsCard flat style={{ paddingVertical: 4 }}>
        <LinkRow label={t('notificationSettings.systemPushLabel')} detail={label} />
        <Divider />
        <LinkRow
          label={t('notificationSettings.openSystemSettings')}
          onPress={() => Linking.openSettings()}
        />
      </SettingsCard>

      <View style={{ paddingHorizontal: 24, paddingTop: 12 }}>
        <Text
          style={{
            fontSize: 12,
            color: theme.colors.muted,
            lineHeight: 18,
          }}
        >
          {t('notificationSettings.hint')}
        </Text>
      </View>
    </SettingsShell>
  );
}
