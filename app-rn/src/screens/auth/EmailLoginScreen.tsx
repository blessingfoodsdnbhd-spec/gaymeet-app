import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Mail, Lock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '../../components/Button';
import { useTheme } from '../../theme/ThemeProvider';
import { loginWithPassword } from '../../api/auth';
import { useAuth } from '../../store/auth';
import { AuthField } from './AuthField';
import type { AuthStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'EmailLogin'>;
type Rt = RouteProp<AuthStackParamList, 'EmailLogin'>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EmailLoginScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const theme = useTheme();
  const { t } = useTranslation();
  const signIn = useAuth((s) => s.signIn);

  const [email, setEmail] = useState(route.params?.email ?? '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const clean = email.trim().toLowerCase();
  const valid = EMAIL_RE.test(clean) && password.length > 0;

  const onSubmit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await loginWithPassword(clean, password);
      await signIn(res.accessToken, res.refreshToken, res.user, res.hasPassword);
      // On success RootNavigator swaps to the app — nothing else to do.
    } catch (e: any) {
      const detail = e?.response?.data?.error || e?.response?.data?.message;
      setErr(detail || t('auth.loginFailedInvalid'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
          <Pressable onPress={() => nav.goBack()} hitSlop={8}>
            <ChevronLeft size={28} color={theme.colors.text} />
          </Pressable>
        </View>

        <View style={{ flex: 1, paddingHorizontal: 28, paddingTop: 24 }}>
          <Text
            style={{
              fontSize: theme.typography.size.h2,
              fontWeight: theme.typography.weight.bold,
              color: theme.colors.text,
              letterSpacing: -0.4,
            }}
          >
            {t('auth.loginTitle')}
          </Text>
          <Text style={{ marginTop: 8, fontSize: 14, color: theme.colors.text2, lineHeight: 21 }}>
            {t('auth.loginSubtitle')}
          </Text>

          <View style={{ marginTop: 20 }}>
            <AuthField
              icon={<Mail size={18} color={theme.colors.muted} strokeWidth={1.6} />}
              value={email}
              onChangeText={setEmail}
              placeholder={t('email.placeholder')}
              keyboardType="email-address"
              autoComplete="email"
              textContentType="username"
              returnKeyType="next"
            />
            <AuthField
              icon={<Lock size={18} color={theme.colors.muted} strokeWidth={1.6} />}
              secure
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                if (err) setErr(null);
              }}
              placeholder={t('auth.password')}
              autoComplete="password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={onSubmit}
            />
            {err && (
              <Text style={{ color: theme.colors.danger, fontSize: 13, marginTop: 10 }}>{err}</Text>
            )}

            <Pressable
              onPress={() => nav.navigate('ForgotPassword', { email: clean })}
              hitSlop={8}
              style={{ alignSelf: 'flex-end', marginTop: 14 }}
            >
              <Text style={{ color: theme.colors.primary, fontSize: 13.5, fontWeight: '500' }}>
                {t('auth.forgotPassword')}
              </Text>
            </Pressable>
          </View>

          <View style={{ marginTop: 24 }}>
            <Button
              label={t('auth.login')}
              onPress={onSubmit}
              disabled={!valid}
              loading={busy}
              fullWidth
            />
          </View>

          {/* OTP fallback — existing verification-code sign-in for legacy users. */}
          <Pressable
            onPress={() => nav.navigate('EmailEntry')}
            hitSlop={8}
            style={{ alignSelf: 'center', marginTop: 22 }}
          >
            <Text style={{ color: theme.colors.text2, fontSize: 13.5, fontWeight: '500' }}>
              {t('auth.useOtpLogin')} →
            </Text>
          </Pressable>
        </View>

        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 4,
            paddingBottom: 24,
          }}
        >
          <Text style={{ color: theme.colors.muted, fontSize: 13.5 }}>{t('auth.noAccount')}</Text>
          <Pressable onPress={() => nav.navigate('Register')} hitSlop={8}>
            <Text style={{ color: theme.colors.primary, fontSize: 13.5, fontWeight: '600' }}>
              {t('auth.register')}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
