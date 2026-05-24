import React, { useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../store/auth';
import { deleteAccount } from '../../../api/me';
import { SettingsShell, SettingsCard, LinkRow, Divider } from './SettingsShell';

export function AccountSettings() {
  const { t } = useTranslation();
  const user = useAuth((s) => s.user);
  const signOut = useAuth((s) => s.signOut);
  const [deleting, setDeleting] = useState(false);

  const confirmSignOut = () => {
    Alert.alert(t('accountSettings.signOutConfirmTitle'), t('accountSettings.signOutConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('accountSettings.signOutButton'), style: 'destructive', onPress: () => signOut() },
    ]);
  };

  // Two-step destructive confirm — required for Apple guideline 5.1.1(v).
  const confirmDelete = () => {
    if (deleting) return;
    Alert.alert(
      t('accountSettings.deleteStep1Title'),
      t('accountSettings.deleteStep1Body'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('accountSettings.deleteStep1Continue'),
          style: 'destructive',
          onPress: () =>
            Alert.alert(
              t('accountSettings.deleteStep2Title'),
              t('accountSettings.deleteStep2Body'),
              [
                { text: t('common.cancel'), style: 'cancel' },
                {
                  text: t('accountSettings.deleteStep2Confirm'),
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
                        t('accountSettings.deleteFailed'),
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
    <SettingsShell title={t('accountSettings.title')}>
      <SettingsCard flat style={{ paddingVertical: 4 }}>
        <LinkRow label={t('accountSettings.emailLabel')} detail={user?.email ?? '—'} />
      </SettingsCard>

      <SettingsCard flat style={{ paddingVertical: 4 }}>
        <LinkRow label={t('accountSettings.signOut')} onPress={confirmSignOut} />
        <Divider />
        <LinkRow
          label={deleting ? t('accountSettings.deleting') : t('accountSettings.deleteAccount')}
          destructive
          onPress={confirmDelete}
        />
      </SettingsCard>
    </SettingsShell>
  );
}
