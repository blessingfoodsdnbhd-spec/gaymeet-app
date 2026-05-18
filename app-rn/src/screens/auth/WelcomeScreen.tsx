import React from 'react';
import { View, Text, Image, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useTranslation } from 'react-i18next';

import { Button } from '../../components/Button';
import { useTheme } from '../../theme/ThemeProvider';
import { brandGradient } from '../../theme/tokens';
import type { AuthStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Welcome'>;

export function WelcomeScreen() {
  const nav = useNavigation<Nav>();
  const theme = useTheme();
  const { t } = useTranslation();

  const onApple = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      // TODO: POST /auth/apple with credential.identityToken
      console.log('apple ok', credential);
    } catch (e) {
      // user cancel — silent no-op
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={styles.center}>
        <Image
          source={require('../../assets/logo.jpg')}
          style={{ width: 148, height: 148, borderRadius: 38 }}
          // soft purple shadow to lift the logo off the cream bg
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
            fullWidth
          />
        )}
        <Button
          label={t('welcome.continueGoogle')}
          variant="ghost"
          onPress={() => {
            /* TODO: GoogleSignin.signIn */
          }}
          fullWidth
        />
        <Button
          label={t('welcome.continueEmail')}
          variant="ghost"
          onPress={() => nav.navigate('EmailEntry')}
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
