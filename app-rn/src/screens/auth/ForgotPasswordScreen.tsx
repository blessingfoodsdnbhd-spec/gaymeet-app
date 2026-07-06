import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Mail, Lock, KeyRound } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '../../components/Button';
import { useTheme } from '../../theme/ThemeProvider';
import { sendResetCode, resetPassword, loginWithPassword } from '../../api/auth';
import { useAuth } from '../../store/auth';
import { AuthField } from './AuthField';
import type { AuthStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'ForgotPassword'>;
type Rt = RouteProp<AuthStackParamList, 'ForgotPassword'>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ForgotPasswordScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const theme = useTheme();
  const { t } = useTranslation();
  const signIn = useAuth((s) => s.signIn);

  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [email, setEmail] = useState(route.params?.email ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const clean = email.trim().toLowerCase();

  const sendCode = async () => {
    if (!EMAIL_RE.test(clean) || busy) return;
    setBusy(true);
    setErr(null);
    try {
      // Always resolves (anti-enumeration) — proceed to the reset step regardless.
      await sendResetCode(clean);
      setStep('reset');
    } catch (e: any) {
      const detail = e?.response?.data?.error || e?.response?.data?.message;
      setErr(detail || t('auth.genericError'));
    } finally {
      setBusy(false);
    }
  };

  const submitReset = async () => {
    if (busy) return;
    if (code.trim().length !== 6) {
      setErr(t('otp.invalid'));
      return;
    }
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
      await resetPassword(clean, code.trim(), password);
      // Reset revokes all sessions server-side — log in fresh with the new password.
      const res = await loginWithPassword(clean, password);
      await signIn(res.accessToken, res.refreshToken, res.user, res.hasPassword);
    } catch (e: any) {
      const detail = e?.response?.data?.error || e?.response?.data?.message;
      setErr(detail || t('auth.genericError'));
    } finally {
      setBusy(false);
    }
  };

  const iconMuted = { color: theme.colors.muted, strokeWidth: 1.6 as const, size: 18 };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
        <Pressable
          onPress={() => (step === 'reset' ? setStep('email') : nav.goBack())}
          hitSlop={10}
        >
          <ChevronLeft size={28} color={theme.colors.text} />
        </Pressable>
      </View>

      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 28, paddingTop: 24, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text
            style={{
              fontSize: theme.typography.size.h2,
              fontWeight: theme.typography.weight.bold,
              color: theme.colors.text,
              letterSpacing: -0.4,
            }}
          >
            {step === 'email' ? t('auth.resetTitle') : t('auth.resetSetTitle')}
          </Text>
          <Text style={{ marginTop: 8, fontSize: 14, color: theme.colors.text2, lineHeight: 21 }}>
            {step === 'email' ? t('auth.resetSubtitle') : t('auth.resetSent')}
          </Text>

          {step === 'email' ? (
            <>
              <View style={{ marginTop: 20 }}>
                <AuthField
                  icon={<Mail {...iconMuted} />}
                  value={email}
                  onChangeText={setEmail}
                  placeholder={t('email.placeholder')}
                  keyboardType="email-address"
                  autoComplete="email"
                  returnKeyType="next"
                  onSubmitEditing={sendCode}
                />
                {err && (
                  <Text style={{ color: theme.colors.danger, fontSize: 13, marginTop: 10 }}>{err}</Text>
                )}
              </View>
              <View style={{ marginTop: 24 }}>
                <Button
                  label={t('email.cta')}
                  onPress={sendCode}
                  disabled={!EMAIL_RE.test(clean)}
                  loading={busy}
                  fullWidth
                />
              </View>
            </>
          ) : (
            <>
              <Text style={{ marginTop: 12, fontSize: 13.5, color: theme.colors.text2 }}>{clean}</Text>
              <View style={{ marginTop: 12 }}>
                <AuthField
                  icon={<KeyRound {...iconMuted} />}
                  value={code}
                  onChangeText={(v) => {
                    setCode(v.replace(/\D/g, '').slice(0, 6));
                    if (err) setErr(null);
                  }}
                  placeholder={t('auth.codePlaceholder')}
                  keyboardType="number-pad"
                  maxLength={6}
                  textContentType="oneTimeCode"
                  style={{ letterSpacing: 4 }}
                />
                <AuthField
                  icon={<Lock {...iconMuted} />}
                  secure
                  value={password}
                  onChangeText={(v) => {
                    setPassword(v);
                    if (err) setErr(null);
                  }}
                  placeholder={t('auth.newPassword')}
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
                  onSubmitEditing={submitReset}
                />
                {err && (
                  <Text style={{ color: theme.colors.danger, fontSize: 13, marginTop: 12 }}>{err}</Text>
                )}
              </View>
              <View style={{ marginTop: 24 }}>
                <Button label={t('auth.resetPassword')} onPress={submitReset} loading={busy} fullWidth />
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
