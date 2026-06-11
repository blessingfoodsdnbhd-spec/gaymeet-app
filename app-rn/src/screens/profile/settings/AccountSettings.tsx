import React, { useState } from 'react';
import {
  Alert,
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useAuth } from '../../../store/auth';
import { deleteAccount, exportAccountData } from '../../../api/me';
import { restoreSubscriptions } from '../../../utils/iap';
import { useTheme } from '../../../theme/ThemeProvider';
import { Sheet } from '../../../components/Sheet';
import { SettingsShell, SettingsCard, LinkRow, Divider } from './SettingsShell';

export function AccountSettings() {
  const { t } = useTranslation();
  const theme = useTheme();
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const signOut = useAuth((s) => s.signOut);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [typedEmail, setTypedEmail] = useState('');

  const email = user?.email ?? '';
  // Enable the destructive action only when the typed value exactly matches the
  // account email (case-insensitive) — the Apple-recommended pattern for an
  // irreversible action.
  const emailMatches =
    !!email && typedEmail.trim().toLowerCase() === email.trim().toLowerCase();

  const confirmSignOut = () => {
    Alert.alert(t('accountSettings.signOutConfirmTitle'), t('accountSettings.signOutConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('accountSettings.signOutButton'), style: 'destructive', onPress: () => signOut() },
    ]);
  };

  const openDelete = () => {
    if (deleting) return;
    setTypedEmail('');
    setConfirmOpen(true);
  };

  const doDelete = async () => {
    if (!emailMatches || deleting) return;
    setDeleting(true);
    try {
      await deleteAccount();
      setConfirmOpen(false);
      // Wipe tokens locally — server has already removed the user.
      await signOut();
    } catch (e: any) {
      const status = e?.response?.status;
      const detail =
        e?.response?.data?.error || e?.response?.data?.message || e?.message || 'unknown';
      Alert.alert(
        t('accountSettings.deleteFailed'),
        `${detail}${status ? ` (HTTP ${status})` : ''}`,
      );
    } finally {
      setDeleting(false);
    }
  };

  // GDPR — fetch the full JSON export, write it to a cache file, and hand it to
  // the OS share sheet so the user can save / email / AirDrop their own data.
  const doExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const data = await exportAccountData();
      const json = JSON.stringify(data, null, 2);
      const uri = `${FileSystem.cacheDirectory}meyou-data-export.json`;
      await FileSystem.writeAsStringAsync(uri, json, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/json',
          dialogTitle: t('accountSettings.exportData'),
          UTI: 'public.json',
        });
      }
    } catch {
      Alert.alert(t('accountSettings.exportFailed'));
    } finally {
      setExporting(false);
    }
  };

  // Restore a previously-purchased subscription from Settings. Mirrors the
  // paywall's onRestore (PremiumScreen) so a user who reinstalled and isn't
  // currently Premium can recover without opening the upgrade screen. Replays
  // the native receipt / purchaseToken through the verify backend, which
  // re-grants premium. Reuses the premium.restore* strings.
  const doRestore = async () => {
    if (restoring) return;
    setRestoring(true);
    try {
      const restored = await restoreSubscriptions();
      if (restored) {
        setUser({ ...(user as any), ...restored });
        Alert.alert(t('premium.restoreSuccessTitle'), t('premium.restoreSuccessBody'));
      } else {
        Alert.alert(t('premium.restoreNothingTitle'), t('premium.restoreNothingBody'));
      }
    } catch (e: any) {
      Alert.alert(t('premium.restoreFailedTitle'), e?.message ?? '');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <SettingsShell title={t('accountSettings.title')}>
      {/* Email + delete grouped: the destructive action lives directly under
          the email it targets, per the requested layout. */}
      <SettingsCard flat style={{ paddingVertical: 4 }}>
        <LinkRow label={t('accountSettings.emailLabel')} detail={email || '—'} />
        <Divider />
        <LinkRow
          label={deleting ? t('accountSettings.deleting') : t('accountSettings.deleteAccount')}
          destructive
          onPress={openDelete}
        />
      </SettingsCard>

      <SettingsCard flat style={{ paddingVertical: 4 }}>
        <LinkRow
          label={restoring ? t('accountSettings.restoring') : t('accountSettings.restorePurchases')}
          onPress={doRestore}
        />
      </SettingsCard>

      <SettingsCard flat style={{ paddingVertical: 4 }}>
        <LinkRow
          label={exporting ? t('accountSettings.exporting') : t('accountSettings.exportData')}
          onPress={doExport}
        />
      </SettingsCard>

      <SettingsCard flat style={{ paddingVertical: 4 }}>
        <LinkRow label={t('accountSettings.signOut')} onPress={confirmSignOut} />
      </SettingsCard>

      <Sheet open={confirmOpen} onClose={() => !deleting && setConfirmOpen(false)} maxHeight="62%">
        <Text style={[styles.title, { color: theme.colors.text }]}>
          {t('accountSettings.deleteAccount')}
        </Text>
        <Text style={[styles.warning, { color: theme.colors.danger }]}>
          {t('accountSettings.deleteConfirmWarning')}
        </Text>
        <Text style={[styles.prompt, { color: theme.colors.muted }]}>
          {t('accountSettings.deleteConfirmPrompt')}
        </Text>
        <TextInput
          value={typedEmail}
          onChangeText={setTypedEmail}
          placeholder={email}
          placeholderTextColor={theme.colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          editable={!deleting}
          style={[
            styles.input,
            {
              color: theme.colors.text,
              backgroundColor: theme.colors.surface,
              borderColor: emailMatches ? theme.colors.danger : theme.colors.line,
            },
          ]}
        />

        <Pressable
          onPress={doDelete}
          disabled={!emailMatches || deleting}
          style={[
            styles.deleteBtn,
            { backgroundColor: theme.colors.danger, opacity: emailMatches && !deleting ? 1 : 0.45 },
          ]}
        >
          {deleting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.deleteText}>{t('accountSettings.deleteConfirmButton')}</Text>
          )}
        </Pressable>
        <Pressable
          onPress={() => !deleting && setConfirmOpen(false)}
          style={styles.cancelBtn}
        >
          <Text style={{ color: theme.colors.muted, fontSize: 15, fontWeight: '600' }}>
            {t('common.cancel')}
          </Text>
        </Pressable>
      </Sheet>
    </SettingsShell>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '700', marginBottom: 10 },
  warning: { fontSize: 14, lineHeight: 20, marginBottom: 18, fontWeight: '500' },
  prompt: { fontSize: 13, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 18,
  },
  deleteBtn: {
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  cancelBtn: { height: 48, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
});
