import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Crown } from 'lucide-react-native';

import { Sheet } from './Sheet';
import { useTheme } from '../theme/ThemeProvider';
import { brandGradient } from '../theme/tokens';
import { LinearGradient } from 'expo-linear-gradient';
import { navigateAfterSheetClose } from '../utils/keyboardSheet';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface Props {
  open: boolean;
  title: string;
  body: string;
  onClose: () => void;
}

/**
 * Reusable upsell sheet. Surfaces a feature gated behind Premium
 * (persona-count cap, photo cap, daily unlock-request cap) with one
 * CTA that navigates to PremiumScreen. The caller passes title + body
 * so this stays one component across all callsites — see
 * TopicUnlockRequestSheet / TopicPersonaEditScreen.
 */
export function PremiumGateSheet({ open, title, body, onClose }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();

  return (
    <Sheet open={open} onClose={onClose} maxHeight="60%">
      <LinearGradient
        colors={[...brandGradient.colors] as [string, string, ...string[]]}
        locations={[...brandGradient.locations] as [number, number, ...number[]]}
        start={brandGradient.start}
        end={brandGradient.end}
        style={styles.hero}
      >
        <Crown size={32} color="#FFFFFF" strokeWidth={1.6} />
      </LinearGradient>
      <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
      <Text style={[styles.body, { color: theme.colors.text2 }]}>{body}</Text>
      <View style={styles.row}>
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [
            styles.btn,
            {
              backgroundColor: theme.colors.surface2,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={[styles.btnText, { color: theme.colors.text2 }]}>
            {t('common.cancel')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() =>
            // Defer past the Sheet's Android Dialog teardown — same-tick
            // close+navigate is dropped on Android. navigateAfterSheetClose.
            navigateAfterSheetClose(onClose, () => nav.navigate('Premium'))
          }
          style={({ pressed }) => [
            styles.btn,
            {
              backgroundColor: theme.colors.primary,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={[styles.btnText, { color: '#FFFFFF' }]}>
            {t('topics.upgrade')}
          </Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  hero: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 22,
    paddingHorizontal: 8,
  },
  row: { flexDirection: 'row', gap: 10 },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontSize: 14, fontWeight: '700' },
});
