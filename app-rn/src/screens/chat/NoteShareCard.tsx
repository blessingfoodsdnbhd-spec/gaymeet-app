import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { brandGradient } from '../../theme/tokens';

/** Logical design size; captured at 3× → 1080×1080 PNG (square = FB/IG feed). */
export const CARD_SIZE = 360;
const BODY_MAX = 200;

/**
 * Off-screen branded card for sharing a 小纸条 as an image. The PARENT renders
 * this inside a `ref` View positioned off-screen and captures it with
 * react-native-view-shot. Privacy: only the note body is shown — never the
 * (anonymous) sender's identity.
 */
export function NoteShareCard({ body }: { body: string }) {
  const { t } = useTranslation();
  const text = body.length > BODY_MAX ? `${body.slice(0, BODY_MAX - 1)}…` : body;

  return (
    <View style={styles.card}>
      {/* Brand gradient accent bar */}
      <LinearGradient
        colors={[...brandGradient.colors] as [string, string, ...string[]]}
        locations={[...brandGradient.locations] as [number, number, ...number[]]}
        start={brandGradient.start}
        end={brandGradient.end}
        style={styles.accentBar}
      />

      <View style={styles.inner}>
        {/* Header — wordmark + anonymous-note tag */}
        <View>
          <View style={styles.wordmarkRow}>
            <Text style={styles.wordmark}>Meyou</Text>
            <Text style={styles.wordmarkZh}>密友</Text>
          </View>
          <View style={styles.tagChip}>
            <Text style={styles.tagText}>📝 {t('notes.share.cardTag')}</Text>
          </View>
        </View>

        {/* The note body — big serif italic for impact */}
        <Text style={styles.body} numberOfLines={7}>
          “{text}”
        </Text>

        {/* Footer */}
        <View style={styles.footerRow}>
          <Text style={styles.handle}>{t('notes.share.cardFooter')}</Text>
          <Text style={styles.received}>{t('notes.share.cardReceived')}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  accentBar: { height: 8, width: '100%' },
  inner: {
    flex: 1,
    paddingHorizontal: 34,
    paddingTop: 30,
    paddingBottom: 30,
    justifyContent: 'space-between',
  },
  wordmarkRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  wordmark: {
    fontFamily: 'Fraunces',
    fontStyle: 'italic',
    fontSize: 34,
    color: '#E25CAE',
  },
  wordmarkZh: { fontSize: 14, letterSpacing: 4, color: '#9A8DA6', fontWeight: '500' },
  tagChip: {
    marginTop: 14,
    alignSelf: 'flex-start',
    backgroundColor: '#FBE9F4',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  tagText: { fontSize: 11.5, color: '#C44B98', fontWeight: '600' },
  body: {
    fontFamily: 'Fraunces-Medium',
    fontStyle: 'italic',
    fontSize: 25,
    lineHeight: 34,
    color: '#2A1E33',
    marginVertical: 18,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  handle: { fontSize: 14, fontWeight: '700', color: '#E25CAE' },
  received: { fontSize: 11.5, color: '#9A8DA6' },
});
