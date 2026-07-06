import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  ScrollView,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../theme/ThemeProvider';
import { Button } from '../../components/Button';
import { verifyOtp, sendOtp } from '../../api/auth';
import { useAuth } from '../../store/auth';
import type { AuthStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'OTPCode'>;
type Rt = RouteProp<AuthStackParamList, 'OTPCode'>;

export function OTPCodeScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const signIn = useAuth((s) => s.signIn);

  const [code, setCode] = useState('');
  const [inviteCode, setInviteCode] = useState(route.params.inviteCode ?? '');
  const [busy, setBusy] = useState(false);
  // `err` now holds the exact string to display (the backend's specific reason
  // when present) instead of a sentinel — so the user sees WHY the code failed
  // (expired vs wrong vs not-found), not one generic line.
  const [err, setErr] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(59);
  // Rate-limit cooldown (seconds). On a 429 we disable Continue + show a
  // countdown so the user waits instead of hammering the endpoint.
  const [cooldown, setCooldown] = useState(0);
  // Ref guard so the auto-submit effect + the Continue button can't double-fire
  // verifyOtp in the same tick (setBusy is async).
  const submittingRef = useRef(false);

  // The backend returns bilingual messages as "中文 / English". Show the half
  // that matches the active UI language.
  const localizeBackend = (msg: string) => {
    const parts = msg.split(' / ');
    if (parts.length >= 2) {
      return (i18n.language?.startsWith('zh') ? parts[0] : parts[parts.length - 1]).trim();
    }
    return msg.trim();
  };

  const submit = async (c: string) => {
    if (submittingRef.current || c.length !== 6 || cooldown > 0) return;
    submittingRef.current = true;
    Keyboard.dismiss();
    setBusy(true);
    setErr(null);
    try {
      const res = await verifyOtp(route.params.email, c, inviteCode.trim().toUpperCase() || undefined);
      await signIn(res.accessToken, res.refreshToken, res.user);
      // On success the RootNavigator swaps the whole auth stack for the app —
      // there's no route left to swipe back to, so the code can't be re-entered.
    } catch (e: any) {
      const status = e?.response?.status;
      const backendMsg = e?.response?.data?.error || e?.response?.data?.message;
      if (status === 429) {
        setErr(t('otp.rateLimit'));
        setCooldown(30);
      } else if (backendMsg) {
        // Surface the backend's specific reason (expired / wrong / not-found).
        setErr(localizeBackend(backendMsg));
      } else {
        setErr(t('otp.invalid'));
      }
      setCode('');
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  };

  // Auto-fill a dev code if the backend is in no-email mode.
  useEffect(() => {
    const dc = route.params.devCode;
    if (dc && dc.length === 6) setCode(dc);
  }, [route.params.devCode]);

  useEffect(() => {
    const id = setInterval(() => setResendIn((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);

  // Tick down the rate-limit cooldown (re-enables Continue at 0).
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  // Auto-submit once the OTP is 6 digits AND the optional invite code is either
  // empty or complete (6+ chars) — so a user mid-typing an invite isn't cut off,
  // but the common no-invite login fires immediately.
  const canSubmit = code.length === 6 && (inviteCode.length === 0 || inviteCode.length >= 6);
  useEffect(() => {
    if (canSubmit) submit(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, inviteCode]);

  const resend = async () => {
    if (resendIn > 0) return;
    try {
      const res = await sendOtp(route.params.email);
      if (res?.devCode && res.devCode.length === 6) setCode(res.devCode);
      setResendIn(59);
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 429) {
        // Resent too fast — reflect the rate limit inline + restart the timer.
        setErr(t('otp.rateLimit'));
        setResendIn((s) => Math.max(s, 30));
        return;
      }
      const detail = e?.response?.data?.error || e?.response?.data?.message || e?.message || 'unknown';
      Alert.alert(t('otp.resendFailed'), `${detail}${status ? ` (HTTP ${status})` : ''}`);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      {/* Back arrow — always at the top, above the keyboard. */}
      <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
        <Pressable onPress={() => nav.goBack()} hitSlop={10}>
          <ChevronLeft size={28} color={theme.colors.text} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        // Android: undefined — the root KeyboardProvider emulates adjustResize, so
        // a non-undefined behavior would double-shift the content up.
        behavior="padding"
        style={{ flex: 1 }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
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
              {t('otp.title')}
            </Text>
            <Text style={{ marginTop: 8, fontSize: 14, color: theme.colors.text2 }}>{route.params.email}</Text>

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
              editable={!busy}
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
                width: '100%',
                marginTop: 24,
              }}
            />
            {/* Error / cooldown / expiry hint — the row below the code input.
                Cooldown wins, then any error, else the "valid for 30 min" hint. */}
            {cooldown > 0 ? (
              <Text style={{ color: theme.colors.danger, fontSize: 13, marginTop: 8 }}>
                {t('otp.rateLimit')} ({cooldown})
              </Text>
            ) : err ? (
              <Text style={{ color: theme.colors.danger, fontSize: 13, marginTop: 8 }}>{err}</Text>
            ) : (
              <Text style={{ color: theme.colors.muted, fontSize: 12, marginTop: 8 }}>
                {t('otp.expiresIn', { minutes: 30 })}
              </Text>
            )}

            {/* Optional invite code — new users get 30 days Premium for both sides. */}
            <Text style={{ marginTop: 24, fontSize: 12.5, color: theme.colors.muted }}>
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
                fontSize: 16,
                letterSpacing: 3,
                textAlign: 'center',
                color: theme.colors.text,
                borderWidth: 1,
                borderColor: theme.colors.line,
                borderRadius: 12,
                backgroundColor: theme.colors.surface,
                paddingVertical: 11,
                paddingHorizontal: 16,
                width: '100%',
                marginTop: 8,
              }}
            />

            {/* Primary submit — ALWAYS visible, right below the inputs. Auto-submit
                handles the common case, but this guarantees a tappable path + a
                loading state so the user is never stuck (esp. on Render cold starts). */}
            <View style={{ marginTop: 24 }}>
              <Button
                label={t('otp.verify')}
                onPress={() => submit(code)}
                loading={busy}
                disabled={code.length !== 6 || busy || cooldown > 0}
                fullWidth
              />
            </View>

            <Pressable onPress={resend} disabled={resendIn > 0} style={{ marginTop: 24, alignSelf: 'center' }}>
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
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
