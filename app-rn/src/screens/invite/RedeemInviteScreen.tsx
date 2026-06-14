import React from 'react';
import { View, Text, TextInput, Pressable, Platform, StyleSheet, Alert } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../../theme/ThemeProvider';
import { Button } from '../../components/Button';
import { useAuth } from '../../store/auth';
import { redeemInvite } from '../../api/invites';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<RootStackParamList, 'RedeemInvite'>;

export function RedeemInviteScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const qc = useQueryClient();
  const setUser = useAuth((s) => s.setUser);
  const [code, setCode] = React.useState((route.params?.code ?? '').toUpperCase());
  const [busy, setBusy] = React.useState(false);

  const onRedeem = async () => {
    const c = code.trim().toUpperCase();
    if (c.length < 4 || busy) return;
    setBusy(true);
    try {
      const res = await redeemInvite(c);
      setUser(res.user);
      qc.invalidateQueries({ queryKey: ['invite'] });
      Alert.alert(t('invite.successTitle'), t('invite.success'), [{ text: t('common.ok'), onPress: () => nav.goBack() }]);
    } catch (e: any) {
      const key = e?.response?.data?.code;
      const msg =
        key === 'cantUseSelf'
          ? t('invite.cantUseSelf')
          : key === 'alreadyRedeemed'
            ? t('invite.alreadyRedeemed')
            : t('invite.invalidCode');
      Alert.alert(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: theme.colors.line }]}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8} style={{ marginRight: 10 }}>
          <ChevronLeft size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: '800', color: theme.colors.text }}>{t('invite.redeemTitle')}</Text>
      </View>

      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View style={{ padding: 24, gap: 16 }}>
          <Text style={{ fontSize: 14, color: theme.colors.muted, lineHeight: 21 }}>{t('invite.redeemHint')}</Text>
          <TextInput
            value={code}
            onChangeText={(x) => setCode(x.toUpperCase().slice(0, 8))}
            placeholder={t('invite.codePlaceholder')}
            placeholderTextColor={theme.colors.muted}
            autoCapitalize="characters"
            autoCorrect={false}
            style={{
              borderWidth: 1,
              borderColor: theme.colors.line,
              borderRadius: 14,
              paddingVertical: 16,
              paddingHorizontal: 16,
              fontSize: 24,
              fontWeight: '800',
              letterSpacing: 6,
              textAlign: 'center',
              color: theme.colors.text,
              backgroundColor: theme.colors.surface,
            }}
          />
          <Button label={t('invite.redeemCta')} onPress={onRedeem} loading={busy} disabled={code.trim().length < 4} fullWidth />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
