import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../theme/ThemeProvider';
import { SettingsShell, SettingsCard, LinkRow, Divider } from './settings/SettingsShell';
import { clearMediaCache, getMediaCacheSize, formatBytes } from '../../lib/mediaCache';
import { clearAll as clearLocalChat, messageCount } from '../../lib/localChat';

export function StorageSettings() {
  const theme = useTheme();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [mediaBytes, setMediaBytes] = useState(0);
  const [dmCount, setDmCount] = useState(0);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [size, count] = await Promise.all([getMediaCacheSize(), messageCount()]);
    setMediaBytes(size);
    setDmCount(count);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onClearMedia = () => {
    Alert.alert(t('storage.clearMediaTitle'), t('storage.clearMediaBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('storage.clear'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          await clearMediaCache();
          await refresh();
          setBusy(false);
        },
      },
    ]);
  };

  const onClearChat = () => {
    Alert.alert(t('storage.clearChatTitle'), t('storage.clearChatBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('storage.clear'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          await clearLocalChat();
          await refresh();
          setBusy(false);
        },
      },
    ]);
  };

  return (
    <SettingsShell title={t('storage.title')}>
      {loading ? (
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 24 }} />
      ) : (
        <>
          <SettingsCard flat style={{ paddingVertical: 4 }}>
            <LinkRow label={t('storage.mediaCache')} detail={formatBytes(mediaBytes)} />
            <Divider />
            <LinkRow label={t('storage.localChat')} detail={t('storage.messagesN', { n: dmCount })} />
          </SettingsCard>

          <SettingsCard flat style={{ paddingVertical: 4 }}>
            <LinkRow label={t('storage.clearMedia')} onPress={busy ? undefined : onClearMedia} destructive />
            <Divider />
            <LinkRow label={t('storage.clearChat')} onPress={busy ? undefined : onClearChat} destructive />
          </SettingsCard>

          <Text style={{ paddingHorizontal: 4, marginTop: 12, fontSize: 11.5, color: theme.colors.muted, lineHeight: 16 }}>
            {t('storage.note')}
          </Text>
        </>
      )}
    </SettingsShell>
  );
}
