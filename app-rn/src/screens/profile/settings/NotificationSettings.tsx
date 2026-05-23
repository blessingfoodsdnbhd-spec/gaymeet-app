import React, { useEffect, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import * as Notifications from 'expo-notifications';
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
      ? '已开启'
      : status === 'denied'
      ? '已关闭'
      : status === 'undetermined'
      ? '未设置'
      : '未知';

  return (
    <SettingsShell title="通知">
      <SettingsCard flat style={{ paddingVertical: 4 }}>
        <LinkRow label="系统推送" detail={label} />
        <Divider />
        <LinkRow
          label="打开系统设置"
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
          通知开关由 iOS 系统管理。如果你想停止接收 Meyou 的所有推送,
          请前往「设置 → 通知 → Meyou」关闭。
        </Text>
      </View>
    </SettingsShell>
  );
}
