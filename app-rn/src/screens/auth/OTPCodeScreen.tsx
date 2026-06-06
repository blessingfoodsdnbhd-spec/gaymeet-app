import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, Platform } from 'react-native';
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
  const [inviteCode, setInviteCode] = useState(route.params.inviteCode ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(59);

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
      const res = await verifyOtp(route.params.email, c, inviteCode.trim().toUpperCase() || undefined);
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

        {/* Single visible numeric field. A real, on-screen TextInput captures
            keystrokes reliably across all Android keyboards/IMEs — the previous
            hidden/zero-area input pattern silently dropped input on Android. */}
        <TextInput
          value={code}
          onChangeText={(v) => {
            setCode(v.replace(/\D/g, '').slice(0, 6));
            if (err) setErr(null);
          }}
          keyboardType="number-pad"
          maxLength={6}
          autoFocus={Platform.OS === 'ios'}
          textContentType={Platform.OS === 'ios' ? 'oneTimeCode' : undefined}
          placeholder="000000"
          placeholderTextColor={theme.colors.muted}
          style={{
            fontSize: 28,
            letterSpacing: 12,
            textAlign: 'center',
            color: err ? theme.colors.danger : theme.colors.text,
            borderWidth: 1.5,
            borderColor: err ? theme.colors.danger : theme.colors.line,
            borderRadius: 12,
            backgroundColor: theme.colors.surface,
            paddingVertical: 14,
            paddingHorizontal: 16,
            width: '80%',
            alignSelf: 'center',
            marginTop: 20,
          }}
        />

        {/* Optional invite code — new users get 30 days Premium for both sides. */}
        <Text style={{ marginTop: 24, fontSize: 12.5, color: theme.colors.muted, alignSelf: 'center' }}>
          {t('invite.optionalField')}
        </Text>
        <TextInput
          value={inviteCode}
          onChangeText={(v) => setInviteCode(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder={t('invite.codePlaceholder')}
          placeholderTextColor={theme.colors.muted}
          style={{
            fontSize: 18,
            letterSpacing: 4,
            textAlign: 'center',
            color: theme.colors.text,
            borderWidth: 1,
            borderColor: theme.colors.line,
            borderRadius: 12,
            backgroundColor: theme.colors.surface,
            paddingVertical: 11,
            paddingHorizontal: 16,
            width: '70%',
            alignSelf: 'center',
            marginTop: 8,
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
