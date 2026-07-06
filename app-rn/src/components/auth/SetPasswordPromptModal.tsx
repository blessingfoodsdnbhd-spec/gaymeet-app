import React, { useState } from 'react';
import { Modal, View, Text, Pressable, Alert } from 'react-native';
import { Lock, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../theme/ThemeProvider';
import { Button } from '../Button';
import { AuthField } from '../../screens/auth/AuthField';
import { useAuth } from '../../store/auth';
import { setPassword as setPasswordApi } from '../../api/auth';

/**
 * One-time prompt shown after an OTP-only account signs in, offering to set a
 * password for faster next login. Visibility is driven by the auth store's
 * `promptSetPassword` flag (armed on signIn when the server reports hasPassword
 * === false, cleared on skip/success). Rendered once at the app root (MainTabs).
 */
export function SetPasswordPromptModal() {
  const theme = useTheme();
  const { t } = useTranslation();
  const visible = useAuth((s) => s.promptSetPassword);
  const dismiss = useAuth((s) => s.dismissPasswordPrompt);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const close = () => {
    // Reset local state so a future prompt (next login) starts fresh.
    setPassword('');
    setConfirm('');
    setErr(null);
    dismiss();
  };

  const onSet = async () => {
    if (busy) return;
    if (password.length < 6) {
      setErr(t('auth.passwordMinLength'));
      return;
    }
    if (password !== confirm) {
      setErr(t('auth.passwordMismatch'));
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await setPasswordApi(password);
      close();
      Alert.alert(t('auth.passwordSetSuccess'));
    } catch (e: any) {
      const detail = e?.response?.data?.error || e?.response?.data?.message;
      setErr(detail || t('auth.genericError'));
    } finally {
      setBusy(false);
    }
  };

  const iconMuted = { color: theme.colors.muted, strokeWidth: 1.6 as const, size: 18 };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(31,30,41,0.45)',
          justifyContent: 'center',
          paddingHorizontal: 28,
        }}
      >
        <View
          style={{
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radius.xl,
            padding: 24,
            ...theme.shadows.pop,
          }}
        >
          <Pressable
            onPress={close}
            hitSlop={10}
            style={{ position: 'absolute', top: 16, right: 16, zIndex: 1 }}
          >
            <X size={22} color={theme.colors.muted} />
          </Pressable>

          <Text
            style={{
              fontSize: theme.typography.size.h3,
              fontWeight: theme.typography.weight.bold,
              color: theme.colors.text,
              paddingRight: 24,
            }}
          >
            {t('auth.setPasswordPromptTitle')}
          </Text>
          <Text style={{ marginTop: 8, fontSize: 13.5, color: theme.colors.text2, lineHeight: 20 }}>
            {t('auth.setPasswordPromptSubtitle')}
          </Text>

          <View style={{ marginTop: 8 }}>
            <AuthField
              icon={<Lock {...iconMuted} />}
              secure
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                if (err) setErr(null);
              }}
              placeholder={t('auth.password')}
              textContentType="newPassword"
            />
            <AuthField
              icon={<Lock {...iconMuted} />}
              secure
              value={confirm}
              onChangeText={(v) => {
                setConfirm(v);
                if (err) setErr(null);
              }}
              placeholder={t('auth.confirmPassword')}
              textContentType="newPassword"
              returnKeyType="go"
              onSubmitEditing={onSet}
            />
            {err && (
              <Text style={{ color: theme.colors.danger, fontSize: 13, marginTop: 10 }}>{err}</Text>
            )}
          </View>

          <View style={{ marginTop: 20, gap: 10 }}>
            <Button label={t('auth.setNow')} onPress={onSet} loading={busy} fullWidth />
            <Button label={t('auth.skip')} variant="ghost" onPress={close} disabled={busy} fullWidth />
          </View>
        </View>
      </View>
    </Modal>
  );
}
