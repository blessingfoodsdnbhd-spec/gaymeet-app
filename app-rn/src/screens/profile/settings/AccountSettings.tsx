import React from 'react';
import { Alert } from 'react-native';
import { useAuth } from '../../../store/auth';
import { SettingsShell, SettingsCard, LinkRow, Divider } from './SettingsShell';

export function AccountSettings() {
  const user = useAuth((s) => s.user);
  const signOut = useAuth((s) => s.signOut);

  const confirmSignOut = () => {
    Alert.alert('退出登录', '确定要退出吗?', [
      { text: '取消', style: 'cancel' },
      { text: '退出', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  const confirmDelete = () => {
    Alert.alert(
      '删除账号',
      '所有 chats、动态、匹配将被永久删除。这个操作无法撤销。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '我确认删除',
          style: 'destructive',
          onPress: () => {
            /* TODO: POST /account/delete */
          },
        },
      ],
    );
  };

  return (
    <SettingsShell title="账户与安全">
      <SettingsCard flat style={{ paddingVertical: 4 }}>
        <LinkRow label="邮箱" detail={user?.email ?? '—'} />
        <Divider />
        <LinkRow label="两步验证" detail="关" />
        <Divider />
        <LinkRow label="登录设备" />
      </SettingsCard>

      <SettingsCard flat style={{ paddingVertical: 4 }}>
        <LinkRow label="退出登录" onPress={confirmSignOut} />
        <Divider />
        <LinkRow label="删除账号" destructive onPress={confirmDelete} />
      </SettingsCard>
    </SettingsShell>
  );
}
