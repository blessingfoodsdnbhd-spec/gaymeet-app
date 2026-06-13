import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Mail } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '../../components/Button';
import { useTheme } from '../../theme/ThemeProvider';
import { sendOtp } from '../../api/auth';
import type { AuthStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'EmailEntry'>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EmailEntryScreen() {
  const nav = useNavigation<Nav>();
  const theme = useTheme();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  // Normalize before validating/sending — mobile paste/autocomplete often adds
  // a trailing space or capitalizes, which otherwise fails EMAIL_RE and leaves
  // Continue disabled (and the server lowercases anyway).
  const clean = email.trim().toLowerCase();
  const valid = EMAIL_RE.test(clean);

  const onSubmit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      const res = await sendOtp(clean);
      // devCode present only while no real email provider is configured —
      // pass it through so the OTP screen can auto-fill it.
      nav.navigate('OTPCode', { email: clean, devCode: res?.devCode });
    } catch (e: any) {
      const status = e?.response?.status;
      const detail =
        e?.response?.data?.error || e?.response?.data?.message || e?.message || 'unknown';
      Alert.alert(t('email.sendFailed'), `${detail}${status ? ` (HTTP ${status})` : ''}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <KeyboardAvoidingView
        behavior="padding"
        style={{ flex: 1 }}
      >
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
            {t('email.title')}
          </Text>
          <Text
            style={{
              marginTop: 8,
              fontSize: 14,
              color: theme.colors.text2,
              lineHeight: 21,
            }}
          >
            {t('email.subtitle')}
          </Text>

          <View
            style={{
              marginTop: 28,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.m,
              borderWidth: 1,
              borderColor: theme.colors.line,
              paddingHorizontal: 16,
            }}
          >
            <Mail size={18} color={theme.colors.muted} strokeWidth={1.6} />
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder={t('email.placeholder')}
              placeholderTextColor={theme.colors.muted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              style={{
                flex: 1,
                paddingVertical: 14,
                fontSize: 15,
                color: theme.colors.text,
              }}
              onSubmitEditing={onSubmit}
            />
          </View>
        </View>

        <View style={{ paddingHorizontal: 20, paddingBottom: 24 }}>
          <Button
            label={t('email.cta')}
            onPress={onSubmit}
            disabled={!valid}
            loading={busy}
            fullWidth
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
