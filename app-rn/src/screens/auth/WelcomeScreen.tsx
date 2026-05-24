import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, Platform, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useTranslation } from 'react-i18next';

import { Button } from '../../components/Button';
import { useTheme } from '../../theme/ThemeProvider';
import { useAuth } from '../../store/auth';
import { signInApple, signInGoogle } from '../../api/auth';
import { signInWithGoogle } from '../../utils/googleSignin';
import type { AuthStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Welcome'>;

export function WelcomeScreen() {
  const nav = useNavigation<Nav>();
  const theme = useTheme();
  const { t } = useTranslation();
  const signIn = useAuth((s) => s.signIn);
  const [busy, setBusy] = useState<'apple' | 'google' | null>(null);

  const onApple = async () => {
    if (busy) return;
    let credential: AppleAuthentication.AppleAuthenticationCredential;
    try {
      credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
    } catch (e: any) {
      // ERR_CANCELED → user dismissed the sheet; stay silent.
      if (e?.code === 'ERR_REQUEST_CANCELED') return;
      Alert.alert('登录失败', '请重试');
      return;
    }
    if (!credential.identityToken) {
      Alert.alert('登录失败', 'Apple 没有返回有效凭证,请重试');
      return;
    }
    setBusy('apple');
    try {
      // Apple only includes fullName on the FIRST sign-in for a given Apple
      // ID — pass it through so the backend can persist the user's name.
      const name = credential.fullName
        ? [credential.fullName.givenName, credential.fullName.familyName]
            .filter(Boolean)
            .join(' ')
            .trim() || undefined
        : undefined;
      const res = await signInApple(credential.identityToken, name);
      await signIn(res.accessToken, res.refreshToken, res.user);
    } catch (e: any) {
      const status = e?.response?.status;
      const body = e?.response?.data;
      const detail =
        body?.error ||
        body?.message ||
        e?.message ||
        'unknown';
      console.warn('apple sign-in failed', { status, body, error: e });
      Alert.alert('Apple 登录失败', `${detail}${status ? ` (HTTP ${status})` : ''}`);
    } finally {
      setBusy(null);
    }
  };

  const onGoogle = async () => {
    if (busy) return;
    setBusy('google');
    try {
      const result = await signInWithGoogle();
      if (!result) return; // cancelled or config missing — wrapper alerted
      const res = await signInGoogle(result.idToken);
      await signIn(res.accessToken, res.refreshToken, res.user);
    } catch (e: any) {
      const status = e?.response?.status;
      const body = e?.response?.data;
      const message =
        body?.error ||
        body?.message ||
        e?.userFriendlyMessage ||
        e?.message ||
        '登录失败,稍后再试';
      Alert.alert(
        'Google 登录',
        `${message}${status ? ` (HTTP ${status})` : ''}`,
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={styles.center}>
        <Image
          source={require('../../assets/logo.jpg')}
          style={{ width: 148, height: 148, borderRadius: 38 }}
        />
        <View style={{ marginTop: 22, alignItems: 'center' }}>
          {/* Wordmark — uses Fraunces italic with background-clip-text equivalent.
              On RN we approximate with a MaskedView later; for now solid color. */}
          <GradientText style={{ fontFamily: 'Fraunces', fontSize: 48, fontStyle: 'italic' }}>
            Meyou
          </GradientText>
          <Text
            style={{
              marginTop: 6,
              fontSize: 13,
              color: theme.colors.muted,
              letterSpacing: 6,
              fontWeight: '500',
            }}
          >
            密 友
          </Text>
        </View>

        <View style={{ marginTop: 28, alignItems: 'center' }}>
          <Text
            style={{
              fontSize: 15,
              lineHeight: 22,
              color: theme.colors.text2,
              textAlign: 'center',
              maxWidth: 280,
            }}
          >
            {t('welcome.tagline')}
          </Text>
        </View>
      </View>

      <View style={styles.cta}>
        {Platform.OS === 'ios' && (
          <Button
            label={t('welcome.continueApple')}
            variant="dark"
            onPress={onApple}
            loading={busy === 'apple'}
            disabled={busy === 'google'}
            fullWidth
          />
        )}
        <Button
          label={t('welcome.continueGoogle')}
          variant="ghost"
          onPress={onGoogle}
          loading={busy === 'google'}
          disabled={busy === 'apple'}
          fullWidth
        />
        <Button
          label={t('welcome.continueEmail')}
          variant="ghost"
          onPress={() => nav.navigate('EmailEntry')}
          disabled={!!busy}
          fullWidth
        />
        <Text
          style={{
            fontSize: 11.5,
            color: theme.colors.muted,
            textAlign: 'center',
            marginTop: 14,
            lineHeight: 16,
          }}
        >
          {t('welcome.disclaimer')}
        </Text>
      </View>
    </SafeAreaView>
  );
}

/** Approximates the CSS `background-clip: text` over the brand gradient.
 *  Until a proper MaskedView implementation is wired up, render the text in
 *  the brand-pink solid color — close enough for v0.
 */
function GradientText({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: any;
}) {
  return <Text style={[{ color: '#E25CAE' }, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  cta: { paddingHorizontal: 20, paddingBottom: 24, gap: 12 },
});
