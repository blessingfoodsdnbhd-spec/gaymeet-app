import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Alert, ScrollView } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Mail, Lock, KeyRound } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '../../components/Button';
import { DateField, formatYMD } from '../../components/DateField';
import { useTheme } from '../../theme/ThemeProvider';
import { sendOtp, registerWithPassword } from '../../api/auth';
import { useAuth } from '../../store/auth';
import { AuthField } from './AuthField';
import type { AuthStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Register'>;
type Rt = RouteProp<AuthStackParamList, 'Register'>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 18+ age gate. Meyou is a dating app, so the picker is hard-bounded at
// today−18y: an underage date is not selectable at all, rather than selectable
// and then rejected. The server re-validates regardless (this is UI only).
const MIN_AGE = 18;

export function RegisterScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const theme = useTheme();
  const { t } = useTranslation();
  const signIn = useAuth((s) => s.signIn);

  const [step, setStep] = useState<'email' | 'setup'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [inviteCode, setInviteCode] = useState(route.params?.inviteCode ?? '');
  const [dob, setDob] = useState<Date | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  // Picker bounds, computed once per render off "now": [today−100y, today−18y].
  const now = new Date();
  const dobMax = new Date(now.getFullYear() - MIN_AGE, now.getMonth(), now.getDate());
  const dobMin = new Date(now.getFullYear() - 100, now.getMonth(), now.getDate());
  const dobDefault = new Date(now.getFullYear() - 25, now.getMonth(), now.getDate());

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setInterval(() => setResendIn((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [resendIn > 0]);

  const clean = email.trim().toLowerCase();

  const sendCode = async () => {
    if (!EMAIL_RE.test(clean) || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await sendOtp(clean);
      setStep('setup');
      setResendIn(30);
    } catch (e: any) {
      const detail = e?.response?.data?.error || e?.response?.data?.message || e?.message;
      Alert.alert(t('email.sendFailed'), detail || t('auth.genericError'));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (resendIn > 0) return;
    try {
      await sendOtp(clean);
      setResendIn(30);
    } catch (e: any) {
      const detail = e?.response?.data?.error || e?.response?.data?.message || e?.message;
      Alert.alert(t('otp.resendFailed'), detail || t('auth.genericError'));
    }
  };

  const register = async () => {
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
    // 18+ gate. The picker can't produce an underage date, so this only catches
    // "never opened the picker" — but the server enforces it either way.
    if (!dob) {
      setErr(t('auth.dob.error.required'));
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await registerWithPassword(
        clean,
        password,
        code.trim(),
        inviteCode.trim().toUpperCase() || undefined,
        undefined,
        formatYMD(dob) ?? undefined,
      );
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
          onPress={() => (step === 'setup' ? setStep('email') : nav.goBack())}
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
            {step === 'email' ? t('auth.registerTitle') : t('auth.registerSetTitle')}
          </Text>
          <Text style={{ marginTop: 8, fontSize: 14, color: theme.colors.text2, lineHeight: 21 }}>
            {step === 'email' ? t('auth.registerSubtitle') : t('auth.registerSetSubtitle')}
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
                  onSubmitEditing={register}
                />

                {/* 18+ age gate — required. Bounded picker (max = today−18y),
                    so an underage date can't be picked in the first place. */}
                <View style={{ marginTop: 18 }}>
                  <DateField
                    label={t('auth.dob.label')}
                    placeholder={t('auth.dob.placeholder')}
                    value={dob}
                    onChange={(d) => {
                      setDob(d);
                      if (err) setErr(null);
                    }}
                    minDate={dobMin}
                    maxDate={dobMax}
                    defaultDate={dobDefault}
                  />
                  <Text style={{ marginTop: 6, fontSize: 12, color: theme.colors.muted }}>
                    {t('auth.dob.hint')}
                  </Text>
                </View>

                <Text style={{ marginTop: 18, fontSize: 12.5, color: theme.colors.muted }}>
                  {t('invite.optionalField')}
                </Text>
                <AuthField
                  value={inviteCode}
                  onChangeText={(v) => setInviteCode(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
                  autoCapitalize="characters"
                  placeholder={t('invite.codePlaceholder')}
                  style={{ letterSpacing: 3 }}
                />

                {err && (
                  <Text style={{ color: theme.colors.danger, fontSize: 13, marginTop: 12 }}>{err}</Text>
                )}
              </View>

              <View style={{ marginTop: 24 }}>
                <Button
                  label={t('auth.register')}
                  onPress={register}
                  disabled={!dob}
                  loading={busy}
                  fullWidth
                />
              </View>

              <Pressable
                onPress={resend}
                disabled={resendIn > 0}
                style={{ alignSelf: 'center', marginTop: 22 }}
              >
                <Text
                  style={{
                    color: resendIn > 0 ? theme.colors.muted : theme.colors.primary,
                    fontSize: 14,
                    fontWeight: '500',
                  }}
                >
                  {resendIn > 0 ? t('otp.resend', { seconds: resendIn }) : t('auth.resend')}
                </Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
