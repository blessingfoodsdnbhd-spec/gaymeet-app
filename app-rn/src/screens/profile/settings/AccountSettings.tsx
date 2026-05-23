import React, { useState } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '../../../store/auth';
import { deleteAccount } from '../../../api/me';
import { SettingsShell, SettingsCard, LinkRow, Divider } from './SettingsShell';

export function AccountSettings() {
  const user = useAuth((s) => s.user);
  const signOut = useAuth((s) => s.signOut);
  const [deleting, setDeleting] = useState(false);

  const confirmSignOut = () => {
    Alert.alert('退出登录', '确定要退出吗?', [
      { text: '取消', style: 'cancel' },
      { text: '退出', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  // Two-step destructive confirm — required for Apple guideline 5.1.1(v).
  const confirmDelete = () => {
    if (deleting) return;
    Alert.alert(
      '删除账号',
      '所有聊天、动态、匹配将被永久删除。这个操作无法撤销。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '继续',
          style: 'destructive',
          onPress: () =>
            Alert.alert(
              '再次确认',
              '最终确认 — 你的账号和所有数据将立即被删除。',
              [
                { text: '取消', style: 'cancel' },
                {
                  text: '永久删除',
                  style: 'destructive',
                  onPress: async () => {
                    setDeleting(true);
                    try {
                      await deleteAccount();
                      // Wipe tokens locally — server has already removed the user.
                      await signOut();
                    } catch (e: any) {
                      const status = e?.response?.status;
                      const detail =
                        e?.response?.data?.error ||
                        e?.response?.data?.message ||
                        e?.message ||
                        'unknown';
                      Alert.alert(
                        '删除失败',
                        `${detail}${status ? ` (HTTP ${status})` : ''}`,
                      );
                    } finally {
                      setDeleting(false);
                    }
                  },
                },
              ],
            ),
        },
      ],
    );
  };

  return (
    <SettingsShell title="账户与安全">
      <SettingsCard flat style={{ paddingVertical: 4 }}>
        <LinkRow label="邮箱" detail={user?.email ?? '—'} />
      </SettingsCard>

      <SettingsCard flat style={{ paddingVertical: 4 }}>
        <LinkRow label="退出登录" onPress={confirmSignOut} />
        <Divider />
        <LinkRow
          label={deleting ? '正在删除…' : '删除账号'}
          destructive
          onPress={confirmDelete}
        />
      </SettingsCard>
    </SettingsShell>
  );
}
