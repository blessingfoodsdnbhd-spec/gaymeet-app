import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Crown, Check } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Sheet } from './Sheet';
import { Button } from './Button';
import { useTheme } from '../theme/ThemeProvider';
import { brandGradient } from '../theme/tokens';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// A short, punchy subset of the full benefit list for the pain-point pitch.
const BULLETS = ['profileViewers', 'hideOnline', 'incognito', 'discoveryFilters'] as const;

/**
 * Reusable upgrade pitch shown at pain points (blurred viewers, note quota,
 * premium-gated toggles, etc.). `reason` is the contextual one-liner. The CTA
 * routes to the full PremiumScreen for the actual purchase.
 */
export function UpgradePremiumSheet({
  open,
  onClose,
  reason,
}: {
  open: boolean;
  onClose: () => void;
  reason?: string;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();

  return (
    <Sheet open={open} onClose={onClose} maxHeight="64%">
      <View style={{ alignItems: 'center', paddingTop: 4 }}>
        <LinearGradient
          colors={[...brandGradient.colors] as [string, string, ...string[]]}
          locations={[...brandGradient.locations] as [number, number, ...number[]]}
          start={brandGradient.start}
          end={brandGradient.end}
          style={styles.crown}
        >
          <Crown size={30} color="#FFFFFF" strokeWidth={2} />
        </LinearGradient>
        <Text style={[styles.title, { color: theme.colors.text }]}>{t('premium.upsell.title')}</Text>
        {!!reason && <Text style={[styles.reason, { color: theme.colors.muted }]}>{reason}</Text>}

        <View style={{ alignSelf: 'stretch', marginTop: 20, gap: 12 }}>
          {BULLETS.map((k) => (
            <View key={k} style={styles.bulletRow}>
              <View style={[styles.tick, { backgroundColor: theme.colors.primarySoft }]}>
                <Check size={13} color={theme.colors.primaryDeep} strokeWidth={2.6} />
              </View>
              <Text style={{ flex: 1, fontSize: 14.5, color: theme.colors.text }}>{t(`premium.benefits.${k}`)}</Text>
            </View>
          ))}
        </View>

        <View style={{ alignSelf: 'stretch', marginTop: 22 }}>
          <Button
            label={t('premium.upsell.cta')}
            onPress={() => {
              onClose();
              nav.navigate('Premium');
            }}
            fullWidth
          />
        </View>
        <Pressable onPress={onClose} hitSlop={8} style={{ marginTop: 14, padding: 4 }}>
          <Text style={{ color: theme.colors.muted, fontSize: 14 }}>{t('premium.upsell.later')}</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  crown: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  title: { fontSize: 19, fontWeight: '800', textAlign: 'center' },
  reason: { fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20, paddingHorizontal: 12 },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  tick: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
});
