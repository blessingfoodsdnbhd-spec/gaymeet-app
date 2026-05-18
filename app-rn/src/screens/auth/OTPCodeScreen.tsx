import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
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
    inputRef.current?.focus();
  }, []);

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
    await sendOtp(route.params.email);
    setResendIn(59);
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

        <View style={{ marginTop: 32, flexDirection: 'row', gap: 10 }}>
          {Array.from({ length: 6 }).map((_, i) => {
            const filled = i < code.length;
            const active = i === code.length;
            return (
              <Pressable
                key={i}
                onPress={() => inputRef.current?.focus()}
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
              </Pressable>
            );
          })}
        </View>

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
          style={{ position: 'absolute', opacity: 0 }}
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
