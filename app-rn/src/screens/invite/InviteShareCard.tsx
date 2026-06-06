import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { brandGradient } from '../../theme/tokens';

/** Logical design size; captured at 3× → 1080×1080 PNG. */
export const CARD_SIZE = 360;

/**
 * Off-screen branded card for sharing an invite as an image. Parent renders it
 * inside a ref View and captures it with react-native-view-shot.
 */
export function InviteShareCard({ code, name }: { code: string; name?: string }) {
  const { t } = useTranslation();
  return (
    <View style={styles.card}>
      <LinearGradient
        colors={[...brandGradient.colors] as [string, string, ...string[]]}
        locations={[...brandGradient.locations] as [number, number, ...number[]]}
        start={brandGradient.start}
        end={brandGradient.end}
        style={styles.accentBar}
      />
      <View style={styles.inner}>
        <View style={styles.wordmarkRow}>
          <Text style={styles.wordmark}>Meyou</Text>
          <Text style={styles.wordmarkZh}>密友</Text>
        </View>

        <View style={{ alignItems: 'center' }}>
          <Text style={styles.invitedBy}>{t('invite.card.invitedBy', { name: name || 'Meyou' })}</Text>
          <Text style={styles.reward}>{t('invite.reward')}</Text>
          <View style={styles.codeChip}>
            <Text style={styles.codeText}>{code}</Text>
          </View>
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.url}>meyou.uk/invite/{code}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: CARD_SIZE, height: CARD_SIZE, backgroundColor: '#FFFFFF', overflow: 'hidden' },
  accentBar: { height: 8, width: '100%' },
  inner: { flex: 1, paddingHorizontal: 34, paddingVertical: 30, justifyContent: 'space-between' },
  wordmarkRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  wordmark: { fontFamily: 'Fraunces', fontStyle: 'italic', fontSize: 34, color: '#E25CAE' },
  wordmarkZh: { fontSize: 14, letterSpacing: 4, color: '#9A8DA6', fontWeight: '500' },
  invitedBy: { fontSize: 17, color: '#2A1E33', fontWeight: '700', textAlign: 'center' },
  reward: { fontSize: 14, color: '#9A8DA6', marginTop: 8, textAlign: 'center' },
  codeChip: {
    marginTop: 20,
    backgroundColor: '#FBE9F4',
    borderRadius: 18,
    paddingHorizontal: 28,
    paddingVertical: 16,
  },
  codeText: { fontSize: 40, fontWeight: '900', letterSpacing: 6, color: '#C44B98' },
  footerRow: { alignItems: 'center' },
  url: { fontSize: 14, fontWeight: '700', color: '#E25CAE' },
});
