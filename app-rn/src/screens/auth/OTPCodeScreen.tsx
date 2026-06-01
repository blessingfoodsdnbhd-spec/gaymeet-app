import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../theme/ThemeProvider';
import { verifyOtp, sendOtp } from '../../api/auth';
import { useAuth } from '../../store/auth';
import type { AuthStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'OTPCode'>;
type Rt = RouteProp<AuthStackParamList, 'OTPCode'>;

export function OTPCodeScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const theme = useTheme();
  const { t } = useTranslation();
  const signIn = useAuth((s) => s.signIn);

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(59);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    // Delay so the native TextInput is mounted/ready before we focus —
    // focusing synchronously on mount often no-ops on Android and the
    // keyboard never appears.
    const id = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(id);
  }, []);

  // Temporary: when no real email provider is configured the backend returns
  // the code as route.params.devCode — auto-fill it so login works. The
  // 6-digit auto-submit effect below then signs the user in. Once a real email
  // provider is wired, devCode is undefined and the user types it normally.
  useEffect(() => {
    const dc = route.params.devCode;
    if (dc && dc.length === 6) setCode(dc);
  }, [route.params.devCode]);

  useEffect(() => {
    const id = setInterval(() => setResendIn((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);

  // Auto-submit when 6 digits entered
  useEffect(() => {
    if (code.length === 6 && !busy) submit(code);
  }, [code, busy]);

  const submit = async (c: string) => {
    setBusy(true);
    setErr(null);
    try {
      const res = await verifyOtp(route.params.email, c);
      await signIn(res.accessToken, res.refreshToken, res.user);
    } catch {
      setErr('invalid');
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (resendIn > 0) return;
    try {
      const res = await sendOtp(route.params.email);
      // Re-fill the fresh devCode if the backend is still in no-email mode.
      if (res?.devCode && res.devCode.length === 6) setCode(res.devCode);
      setResendIn(59);
    } catch (e: any) {
      const status = e?.response?.status;
      const detail =
        e?.response?.data?.error || e?.response?.data?.message || e?.message || 'unknown';
      Alert.alert(t('otp.resendFailed'), `${detail}${status ? ` (HTTP ${status})` : ''}`);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8}>
          <ChevronLeft size={28} color={theme.colors.text} />
        </Pressable>
      </View>

      <View style={{ flex: 1, paddingHorizontal: 28, paddingTop: 24, alignItems: 'center' }}>
        <Text
          style={{
            fontSize: theme.typography.size.h2,
            fontWeight: theme.typography.weight.bold,
            color: theme.colors.text,
            letterSpacing: -0.4,
            alignSelf: 'flex-start',
          }}
        >
          {t('otp.title')}
        </Text>
        <Text style={{ marginTop: 8, fontSize: 14, color: theme.colors.text2, alignSelf: 'flex-start' }}>
          {route.params.email}
        </Text>

        {/* Force the keyboard up on tap. Android sometimes leaves the hidden
            input "focused" but with no keyboard — blur then refocus reliably
            reopens it. */}
        <Pressable
          onPress={() => {
            inputRef.current?.blur();
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          style={{ marginTop: 32, flexDirection: 'row', gap: 10 }}
        >
          {Array.from({ length: 6 }).map((_, i) => {
            const filled = i < code.length;
            const active = i === code.length;
            return (
              <View
                key={i}
                style={{
                  width: 44,
                  height: 56,
                  borderRadius: 12,
                  borderWidth: 1.5,
                  borderColor: active
                    ? theme.colors.primary
                    : err
                      ? theme.colors.danger
                      : theme.colors.line,
                  backgroundColor: theme.colors.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 24, fontWeight: '600', color: theme.colors.text }}>
                  {filled ? code[i] : ''}
                </Text>
              </View>
            );
          })}
        </Pressable>

        <TextInput
          ref={inputRef}
          value={code}
          onChangeText={(v) => {
            const clean = v.replace(/\D/g, '').slice(0, 6);
            setCode(clean);
            if (err) setErr(null);
          }}
          keyboardType="number-pad"
          maxLength={6}
          autoComplete="one-time-code"
          autoFocus
          caretHidden
          // Must stay (nearly) on-screen and NOT opacity:0 — an absolutely
          // positioned / fully transparent TextInput often refuses focus on
          // Android, so the keyboard never opens. A 1x1 nearly-invisible box
          // behind the digit cells keeps focus working on both platforms.
          style={{
            position: 'absolute',
            top: 106,
            width: 1,
            height: 1,
            opacity: 0.01,
            color: 'transparent',
          }}
        />

        <Pressable
          onPress={resend}
          disabled={resendIn > 0}
          style={{ marginTop: 32 }}
        >
          <Text
            style={{
              color: resendIn > 0 ? theme.colors.muted : theme.colors.primary,
              fontSize: 14,
              fontWeight: '500',
            }}
          >
            {resendIn > 0 ? t('otp.resend', { seconds: resendIn }) : t('otp.resendCta')}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
